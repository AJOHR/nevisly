const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./load.cjs');
const {parsePlayerPage,readAvailable}=load('src/lib/yahoo/live.ts');
const {parseNhlSchedule,readSchedules,leagueDate}=load('src/lib/nhl/seasonSchedule.ts');
const {composeLiveSeason,matchProjection}=load('src/lib/season/live.ts');
const {manualSeasonFixture}=load('src/lib/season/fixture.ts');
const {allocateWeek}=load('src/lib/season/lineup.ts');
const wrap=items=>({players:Object.assign({count:items.length},...items.map((player,i)=>({[i]:{player}})))});
const player=(id,ownership='freeagents')=>[[{player_key:`465.p.${id}`},{name:{full:`Player ${id}`}},{editorial_team_abbr:'COL'},{position_type:'P'},{eligible_positions:[{position:'C'},{position:'LW'}]},
 {status:'DTD'},{status_full:'Day-To-Day'},{has_player_notes:'1'},{has_recent_player_notes:'0'},{player_notes_last_timestamp:123}],
 {ownership:{ownership_type:ownership,waiver_date:'2026-10-06'}},{percent_owned:{value:'0'}},
 {draft_analysis:{average_pick:'55.5',average_round:'5.5',percent_drafted:'80',preseason_average_pick:'60'}},
 {player_stats:{coverage_type:'season',season:'2026',stats:[{stat:{stat_id:'1',value:'0'}},{stat:{stat_id:'2',value:'-'}}]}}];
test('Yahoo facts preserve ownership, exact status, notes, market and actual coverage separately',()=>{
 const r=parsePlayerPage(wrap([player(1,'W')]),{1:'G',2:'A'},'now'),p=r.players[0],f=r.facts[p.id];
 assert.equal(f.ownership,'W');assert.equal(f.percentOwned,0);assert.equal(f.statusFull,'Day-To-Day');assert.equal(f.hasPlayerNotes,true);assert.equal(f.hasRecentPlayerNotes,false);assert.equal(f.notesTimestamp,123);
 assert.equal(f.draftAnalysis.average_pick,55.5);assert.equal(f.draftAnalysis.preseason_average_pick,60);assert.deepEqual(f.actual.totals,{G:0});assert.equal(f.actual.coverage,'season');
 assert.equal(p.perGame,undefined);assert.equal(p.rosValue,undefined);
});
test('pagination visits terminal page, rejects repeated and partial pages',async()=>{
 const calls=[];const r=await readAvailable(async path=>{calls.push(path);return wrap(calls.length===1?[player(1),player(2)]:[]);},'465.l.1',{},'now',2);
 assert.equal(r.players.length,2);assert.match(calls[1],/start=2/);
 await assert.rejects(readAvailable(async()=>wrap([player(1),player(2)]),'465.l.1',{},'now',2),/repeated/);
 assert.throws(()=>parsePlayerPage({players:{count:2,0:{player:player(1)}}},{},'now'),/Incomplete/);
});
const game=(id,date,type=2)=>({id,season:20262027,gameType:type,gameDate:date,homeTeam:{abbrev:'COL'},awayTeam:{abbrev:'DET'}});
test('NHL regular-season dates exclude preseason and reject wrong seasons/duplicates',()=>{
 const result=parseNhlSchedule({games:[game(1,'2026-10-05',1),game(2,'2026-10-06')]},'COL');assert.equal(result.length,1);assert.equal(result[0].date,'2026-10-06');
 assert.throws(()=>parseNhlSchedule({games:[{...game(2,'2026-10-06'),season:20252026}]},'COL'),/Invalid/);
 assert.throws(()=>parseNhlSchedule({games:[game(2,'2026-10-06'),game(2,'2026-10-06')]},'COL'),/Invalid/);
 assert.throws(()=>parseNhlSchedule({},'COL'),/Missing/);
});
test('team requests deduplicate; failures stay unknown; timezone requires explicit config',async()=>{
 const calls=[];const result=await readSchedules(['COL','COL','LA','LAK','UNKNOWN'],async t=>{calls.push(t);if(t==='LAK')throw Error();return {games:[]};});assert.deepEqual(calls,['COL','LAK']);assert.deepEqual(result.schedules.COL,[]);assert.equal(result.schedules.LAK,undefined);
 assert.equal(leagueDate(new Date('2026-10-06T01:00:00Z'),'America/New_York'),'2026-10-05');assert.throws(()=>leagueDate(new Date(),''));
});
const projection=(name,id='p1')=>({id,name,team:'OLD',positions:['C','LW'],age:25,gp:80,goals:20,assists:40,points:60,ppp:20,sog:200,hits:80,blocks:40});
test('identity normalizes punctuation/accents and trades; duplicate names remain ambiguous',()=>{
 const p={name:'Tim Stützle',positions:['C']};assert.equal(matchProjection(p,[projection('Tim Stutzle')]).id,'p1');
 assert.ok(matchProjection({name:'J.T. Miller',positions:['C']},[projection('JT Miller')]));
 assert.equal(matchProjection(p,[projection('Tim Stutzle'),projection('Tim Stutzle','p2')]),undefined);
});
function fixture(){
 const s=structuredClone(manualSeasonFixture);const p={id:'465.p.1',name:'Example One',team:'COL',positions:['C'],kind:'skater'};
 s.myTeam.roster=[p];s.opponent.roster=[{...p,id:'465.p.2',name:'Example Two'}];s.freeAgents=[{...p,id:'465.p.3',name:'Example Three'}];
 return {snapshot:s,league:{name:'League',key:'465.l.1'},facts:{'465.p.3':{ownership:'freeagents'}},schedules:{COL:parseNhlSchedule({games:[game(1,'2026-10-05'),game(2,'2026-10-07'),game(3,'2026-10-15')]},'COL')},scheduleErrors:{},matchupDates:{start:'2026-10-05',end:'2026-10-11'},calendarDate:'2026-10-06',timeZone:'America/New_York',availableCount:1};
}
test('live composition joins 3/3 projections and exact remaining schedule; actuals do not supply rates',()=>{
 const d=fixture(),r=composeLiveSeason(d,['Example One','Example Two','Example Three'].map((n,i)=>projection(n,`p${i}`)));
 assert.equal(r.coverage.matched,3);assert.equal(r.composition.available,true);const s=r.composition.state;
 assert.deepEqual(s.myTeam.roster[0].gameDates,['2026-10-05','2026-10-07']);assert.equal(allocateWeek(s).usable,1);assert.equal(s.myTeam.roster[0].perGame.G,.25);assert.equal(s.opponent.remaining.G,.25);
 assert.equal(d.snapshot.myTeam.roster[0].perGame,undefined);
});
test('unmatched projection, missing schedule, missing matchup do not fabricate recommendation inputs',()=>{
 const d=fixture(),r=composeLiveSeason(d,[]);assert.equal(r.coverage.matched,0);assert.equal(r.composition.state.myTeam.roster[0].rosValue,undefined);assert.equal(allocateWeek(r.composition.state).production,null);
 delete d.schedules.COL;const noSchedule=composeLiveSeason(d,[]);assert.equal(allocateWeek(noSchedule.composition.state).available,false);
 delete d.snapshot.opponent;assert.equal(composeLiveSeason(d,[]).composition.available,false);
});
test('waivers and unknown ownership stay diagnostic, never immediately actionable; ended week blocked',()=>{
 const d=fixture();d.facts['465.p.3'].ownership='W';assert.equal(composeLiveSeason(d,[]).composition.state.freeAgents.length,0);
 delete d.facts['465.p.3'].ownership;assert.equal(composeLiveSeason(d,[]).coverage.excludedAvailability,1);
 d.calendarDate='2026-10-12';assert.equal(allocateWeek(composeLiveSeason(d,[]).composition.state).available,false);
});
test('live route requires host cookie; explicit source switch has no automatic mock fallback',async()=>{
 const {GET}=load('src/app/api/yahoo/season/live/route.ts'),{NextRequest}=require('next/server');assert.equal((await GET(new NextRequest('https://test/api/yahoo/season/live'))).status,401);
 const fs=require('node:fs'),source=fs.readFileSync('src/components/LiveSeasonMode.tsx','utf8');assert.match(source,/mode==='manual'\?<SeasonMode\/>/);const lifecycle=fs.readFileSync('src/hooks/useLiveSeason.ts','utf8');assert.match(lifecycle,/setError\(/);assert.match(lifecycle,/setData\(null\)/);
});
test('live Yahoo orchestration preserves both rosters, paginated pool and optional date stats',async()=>{
 const {readYahooLive}=load('src/lib/yahoo/live.ts');
 const team=(id,owned)=>[{team_key:`465.l.1.t.${id}`},{name:`Team ${id}`},{is_owned_by_current_login:owned?1:0}];
 const totals={team_stats:{coverage_type:'week',week:'1',stats:[{stat:{stat_id:'1',value:'0'}}]}};
 const payloads={
  'users;use_login=1/games;game_codes=nhl/leagues':{league:{league_key:'465.l.1',name:'League',season:2026,num_teams:10,current_week:1}},
  'league/465.l.1/settings':{settings:{roster_positions:[{roster_position:{position:'C',count:2}}],stat_categories:{stats:[{stat:{stat_id:'1',display_name:'G'}}]}}},
  'league/465.l.1/teams':{teams:{0:{team:team(1,true)},1:{team:team(2,false)}}},
  'team/465.l.1.t.1/roster':{roster:{players:wrap([player(1,'team')]).players}},
  'team/465.l.1.t.2/roster':{roster:{players:wrap([player(2,'team')]).players}},
  'league/465.l.1/scoreboard;week=1':{scoreboard:{week:1,matchups:{count:1,0:{matchup:{week:1,week_start:'2026-10-05',week_end:'2026-10-11',teams:{count:2,0:{team:[team(1,true),totals]},1:{team:[team(2,false),totals]}}}}}}},
 };
 const get=async path=>{
  if(path in payloads)return payloads[path];
  if(path.includes('status=A'))return wrap([player(3,'FA'),player(4,'W')]);
  if(path.includes('/stats;type=date'))return wrap([1,2].map(id=>[{player_key:`465.p.${id}`},{player_stats:{coverage_type:'date',date:'2026-10-06',stats:[{stat:{stat_id:'1',value:'1'}}]}}]));
  if(path.includes('player_keys='))return wrap([player(1,'team'),player(2,'team')]);
  throw Error(path);
 };
 const r=await readYahooLive(get,'2026-10-06T12:00:00Z','2026-10-06');assert.equal(r.availableCount,2);assert.equal(r.facts['465.p.1'].recentActual.totals.G,1);assert.equal(r.snapshot.myTeam.current.G,0);assert.equal(r.snapshot.myTeam.roster[0].perGame,undefined);
 const partial=await readYahooLive(async p=>{if(p.includes('/stats;type=date'))throw Error('unsupported');return get(p);},'now','2026-10-06');assert.equal(partial.facts['465.p.1'].recentActual,undefined);assert.equal(partial.warnings.length,1);
});
test('two Yahoo identities cannot silently share one projection identity',()=>{
 const d=fixture();d.snapshot.opponent.roster[0].name='Example One';const r=composeLiveSeason(d,[projection('Example One')]);assert.equal(r.coverage.matched,0);
});
