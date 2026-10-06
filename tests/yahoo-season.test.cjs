const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./load.cjs');
const {readYahooSeason,selectLeague,parseSettings,parseRoster,parseMatchup}=load('src/lib/yahoo/season.ts');
const {composeSeasonState}=load('src/lib/season/provider.ts');
const {seasonConfiguration}=load('src/lib/season/config.ts');
const wrap=(key,items)=>Object.assign({count:items.length,irrelevant:'metadata'},...items.map((x,i)=>({[i]:{[key]:x}})));
const team=(id,name,owned)=>[{team_key:`465.l.10.t.${id}`},{team_id:String(id)},{name},{is_owned_by_current_login:owned?1:0}];
const cat=['G','A','P','PPP','SOG','HIT','BLK','W','SV%','SO'];
const settings={settings:[{roster_positions:[{roster_position:{position:'C',count:2}},{roster_position:{position:'D',count:4}}]},
 {stat_categories:{stats:cat.map((display_name,i)=>({stat:{stat_id:String(i+1),display_name}}))}}]};
const player=(id,pos,type='P')=>[[{player_key:`465.p.${id}`},{player_id:String(id)},{name:{full:`Player ${id}`}},{editorial_team_abbr:'COL'},
 {position_type:type},{eligible_positions:pos.map(position=>({position}))},{selected_position:[{position:pos[0]}]},{status:'DTD'}]];
const roster=(items)=>({team:[team(1,'Mine',true),{roster:{coverage_type:'date',date:'2026-10-05',players:wrap('player',items)}}]});
function payloads(){
 const matchup={week:'1',week_start:'2026-10-05',week_end:'2026-10-11',teams:wrap('team',[
  [team(1,'Yzerplan',true),{team_stats:{coverage_type:'week',week:'1',stats:[{stat:{stat_id:'1',value:'0'}},{stat:{stat_id:'2',value:'-'}},{stat:{stat_id:'9',value:'.913'}}]}}],
  [team(2,'Opponent',false),{team_stats:{coverage_type:'week',week:'1',stats:[{stat:{stat_id:'1',value:'3'}},{stat:{stat_id:'9',value:'.902'}}]}}]])};
 return {
 'users;use_login=1/games;game_codes=nhl/leagues':{users:wrap('user',[{games:wrap('game',[{leagues:wrap('league',[
  {league_key:'453.l.9',name:'Old',season:'2025'},
  {league_key:'465.l.10',league_id:'10',name:'Real league',season:'2026',num_teams:'10',current_week:'1'}])}])}])},
 'league/465.l.10/settings':settings,
 'league/465.l.10/teams':{teams:wrap('team',[team(2,'Opponent',false),team(1,'Yzerplan',true)])},
 'team/465.l.10.t.1/roster':roster([player(1,['C','LW']),player(2,['G'],'G')]),
 'team/465.l.10.t.2/roster':roster([player(3,['D'])]),
 'league/465.l.10/scoreboard;week=1':{scoreboard:{week:'1',matchups:wrap('matchup',[matchup])}},
 };
}
const read=async p=>readYahooSeason(async path=>{assert.ok(path in p,path);return p[path];},2026,'2026-10-05T12:00:00Z');
test('selects explicit current season; rejects historical-only and ambiguous leagues',()=>{
 assert.equal(selectLeague(payloads()['users;use_login=1/games;game_codes=nhl/leagues'],2026).name,'Real league');
 assert.throws(()=>selectLeague({league:{season:2025}},2026),/No NHL/);
 assert.throws(()=>selectLeague({leagues:wrap('league',[{season:2026,league_key:'465.l.1',name:'A'},{season:2026,league_key:'465.l.2',name:'B'}])},2026),/Multiple/);
});
test('resolves owned team independently of name/order, opponent and both rosters',async()=>{
 const p=payloads();p['league/465.l.10/teams'].teams[1].team[2].name='Renamed team';
 const r=await read(p);assert.equal(r.myTeam.name,'Renamed team');assert.equal(r.opponent.name,'Opponent');
 assert.equal(r.snapshot.myTeam.roster.length,2);assert.equal(r.snapshot.opponent.roster.length,1);
 assert.deepEqual(r.snapshot.myTeam.roster[0].positions,['C','LW']);assert.equal(r.snapshot.myTeam.roster[1].kind,'goalie');
 assert.equal(r.rosterDetails.mine['465.p.1'].selectedPosition,'C');assert.equal(r.rosterDetails.mine['465.p.1'].status,'DTD');
 assert.deepEqual(r.matchupDates,{start:'2026-10-05',end:'2026-10-11'});
});
test('maps only enabled settings using supplied stat IDs; rejects unsupported categories',()=>{
 const s=structuredClone(settings);s.settings[1].stat_categories.stats[0].stat.stat_id='99';
 s.settings[1].stat_categories.stats.push({stat:{stat_id:'500',display_name:'PIM',enabled:'0'}});
 assert.equal(parseSettings(s).statMap['99'],'G');assert.equal(parseSettings(s).categories.includes('PIM'),false);
 s.settings[1].stat_categories.stats.at(-1).stat.enabled='1';assert.throws(()=>parseSettings(s),/Unsupported/);
});
test('zero and SV ratio are preserved; absent values and non-provider projections stay unknown',async()=>{
 const {snapshot:s}=await read(payloads());assert.equal(s.myTeam.current.G,0);assert.equal(s.myTeam.current.A,undefined);
 assert.equal(s.myTeam.current['SV%'],.913);assert.equal(s.opponent.current.G,3);
 for(const k of ['perGame','rosValue','gameDates'])assert.equal(s.myTeam.roster[0][k],undefined);
 for(const k of ['freeAgents','weekDates','swingUnits'])assert.equal(s[k],undefined);
 assert.equal(s.myTeam.remaining,undefined);
});
test('missing/partial roster collections fail explicitly; confirmed empty roster is preserved',()=>{
 assert.throws(()=>parseRoster({roster:{}}),/Missing/);
 const r=roster([player(1,['C'])]);r.team[1].roster.players.count=2;assert.throws(()=>parseRoster(r),/Incomplete/);
 assert.deepEqual(parseRoster(roster([])).players,[]);
 assert.throws(()=>parseRoster(roster([player(1,[])])),/eligible/);
});
test('missing matchup is unknown, wrong week and malformed matchup fail',async()=>{
 const p=payloads();p['league/465.l.10/scoreboard;week=1'].scoreboard.matchups=wrap('matchup',[]);
 assert.equal((await read(p)).snapshot.opponent,undefined);
 const b=payloads()['league/465.l.10/scoreboard;week=1'];b.scoreboard.week='2';
 assert.throws(()=>parseMatchup(b,'465.l.10.t.1',1,{}),/week mismatch/);
 assert.throws(()=>parseMatchup({scoreboard:{week:1}},'465.l.10.t.1',1,{}),/Missing/);
});
test('snapshot composition blocks missing out-of-scope inputs, succeeds with explicit structural supplements',async()=>{
 const {snapshot:s}=await read(payloads());const incomplete=composeSeasonState(s,seasonConfiguration);
 assert.equal(incomplete.available,false);assert.deepEqual(incomplete.missing,['freeAgents','myTeam.remaining','opponent.remaining']);
 // A future caller supplies explicitly known collections/empty observations; the adapter does not.
 const full={...s,freeAgents:[],myTeam:{...s.myTeam,remaining:{}},opponent:{...s.opponent,remaining:{}}};
 const composed=composeSeasonState(full,seasonConfiguration);assert.equal(composed.available,true);
 assert.equal(composed.state.myTeam.roster[0].rosValue,undefined);
});
test('ambiguous ownership does not select the first team',async()=>{
 const p=payloads();p['league/465.l.10/teams'].teams[0].team[3].is_owned_by_current_login=1;
 await assert.rejects(read(p),/one team owned/);
});
test('diagnostic requires host cookie and returns no token or raw Yahoo payload',async()=>{
 const {NextRequest}=require('next/server');const {GET}=load('src/app/api/yahoo/season/route.ts');
 assert.equal((await GET(new NextRequest('https://example.test/api/yahoo/season'))).status,401);
 const original=global.fetch,p=payloads(),secret='test-token-do-not-return';
 global.fetch=async(url,options)=>{
  assert.equal(options.headers.Authorization,`Bearer ${secret}`);assert.equal(options.cache,'no-store');
  const path=String(url).split('/fantasy/v2/')[1].split('?')[0];assert.ok(path in p);
  return new Response(JSON.stringify(p[path]),{status:200});
 };
 try{
  const response=await GET(new NextRequest('https://example.test/api/yahoo/season',{headers:{cookie:`yahoo_access_token=${secret}`}}));
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');
  const body=await response.text();assert.ok(!body.includes(secret));
  const data=JSON.parse(body);assert.equal(data.myTeam.name,'Yzerplan');assert.equal(data.composition.available,false);
 }finally{global.fetch=original;}
});
