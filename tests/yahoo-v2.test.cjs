const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./load.cjs');const {DEFAULT_SESSION,parseSession}=load('src/lib/session/session.ts');
const {bindYahooBridge,receiveYahooV2}=load('src/lib/draft/yahooV2.ts');const {nextPickNumber,getNextTurn}=load('src/lib/draft/state.ts');
const capture=require('./fixtures/yahoo-pick19.json');
const offer={schemaVersion:2,type:'offer',sourceTab:'1',roomPath:'/draft/hockey/2253754/9',stream:'local-test-stream',capturedAt:900,capture};
const session=()=>bindYahooBridge(structuredClone(DEFAULT_SESSION),offer);
const frame=(sequence=1,c=capture)=>({schemaVersion:2,type:'observation',roomPath:offer.roomPath,stream:offer.stream,destinationSessionId:DEFAULT_SESSION.id,sequence,capturedAt:900,capture:c});
const send=(s,f,approve=false)=>receiveYahooV2(s,f,[],1000,approve);
test('captured 18 selections preserve Yahoo IDs, owner slots and goalie without projections',()=>{const r=send(session(),frame());assert.equal(r.status,'applied');assert.equal(r.session.draftPicks.length,18);assert.equal(nextPickNumber(r.session.draftPicks),19);assert.equal(r.session.draftPicks[8].resolution,'goalie');assert.equal(r.session.draftPicks[8].yahooPlayerId,'5699');assert.equal(r.session.draftPicks[15].fantasyTeamId,'team-9');assert.equal(r.session.bridge.coverage,'complete-through-header');});
test('same-revision replay is idempotent after persistence',()=>{const s=parseSession(JSON.stringify(send(session(),frame()).session));const r=send(s,frame());assert.deepEqual(r.session.draftPicks,s.draftPicks);assert.equal(r.status,'replayed');});
test('same-revision contradictions cannot mutate retained history',()=>{const s=send(session(),frame()).session;const c=structuredClone(capture);c.rows[0].playerName='Different';const r=send(s,frame(1,c));assert.equal(r.status,'rejected');assert.deepEqual(r.session,s);});
test('wrong destination, room and source stream are rejected',()=>{const s=session();for(const change of [{destinationSessionId:'another'},{roomPath:'/draft/hockey/7/9'},{stream:'other-stream'}]){const r=send(s,{...frame(),...change});assert.equal(r.status,'rejected');assert.deepEqual(r.session,s);}});
test('legacy events cannot update a bound v2 session',()=>{const {applyYahooMessage}=load('src/lib/draft/yahoo.ts');const s=session();assert.deepEqual(applyYahooMessage(s,{pickNumber:99},'pick',[]),s);});
test('partial snapshots retain numbered unknowns and recover missed picks',()=>{const c=structuredClone(capture);c.rows=c.rows.filter(p=>p.pickNumber!==8);c.coverage='partial';c.issues=['missing row'];const s=send(session(),frame(1,c)).session;assert.equal(s.draftPicks.length,17);const r=send(s,frame(2));assert.equal(r.session.draftPicks.length,18);assert.equal(r.session.bridge.coverage,'complete-through-header');});
test('a contiguous prefix is rejected when falsely declared complete',()=>{const c=structuredClone(capture);c.rows.pop();const r=send(session(),frame(1,c));assert.equal(r.status,'rejected');assert.equal(r.session.draftPicks.length,0);});
test('missing player data retains its real number and available owner',()=>{const c=structuredClone(capture);Object.assign(c.rows[17],{playerName:'',yahooPlayerId:undefined,positions:[],nhlTeam:''});c.coverage='partial';c.issues=['missing metadata'];const s=send(session(),frame(1,c)).session;assert.equal(s.draftPicks[17].pickNumber,18);assert.equal(s.draftPicks[17].yahooPlayerId,undefined);assert.equal(s.draftPicks[17].ownerName,'Owner 7');});
test('unknown owner names are preserved without fabricating a Yahoo team key',()=>{const c=structuredClone(capture);c.rows[17].ownerName='Unmapped owner';c.coverage='partial';c.issues=['unmapped'];const s=send(session(),frame(1,c)).session;assert.equal(s.draftPicks[17].fantasyTeamId,'unassigned');assert.equal(s.draftPicks[17].ownerName,'Unmapped owner');assert.doesNotThrow(()=>parseSession(JSON.stringify(s)));});
test('snake turn calculations include every captured goalie and unknown selection',()=>{const s=send(session(),frame()).session;assert.equal(getNextTurn(s.draftPicks,12,6).currentPick,19);assert.equal(getNextTurn(s.draftPicks,12,6).onClock,true);});
test('older snapshots cannot move progress back after newer capture',()=>{const c=structuredClone(capture);c.rows.push({...c.rows[0],pickNumber:19,round:2,yahooPlayerId:'99999',playerName:'Unprojected',ownerName:'Owner 6'});c.currentPick=20;const s=send(session(),frame(2,c)).session;const r=send(s,frame(1));assert.equal(nextPickNumber(r.session.draftPicks),20);});
test('corrections require local review of the latest complete observation',()=>{const s=send(session(),frame()).session;const c=structuredClone(capture);c.rows[0].yahooPlayerId='99999';c.rows[0].playerName='Corrected';const f=frame(2,c);const pending=send(s,f);assert.equal(pending.status,'rejected');assert.deepEqual(pending.session.draftPicks,s.draftPicks);const corrected=send(pending.session,f,true);assert.equal(corrected.status,'applied');assert.equal(corrected.session.draftPicks[0].selectionId,s.draftPicks[0].selectionId);assert.equal(corrected.session.draftPicks[0].yahooPlayerId,'99999');});
test('a partial capture cannot authorize deletion',()=>{const s=send(session(),frame()).session;const c=structuredClone(capture);c.rows.pop();c.coverage='partial';assert.equal(send(s,frame(2,c),true).status,'rejected');});
test('league mismatch cannot be bound',()=>{assert.throws(()=>bindYahooBridge({...DEFAULT_SESSION,leagueTeams:10},offer),/12 teams/);});
test('unsupported layout retains manual/history state and reports extraction failure',()=>{const s=send(session(),frame()).session;const c={rows:[],issues:['Unsupported layout'],coverage:'partial',currentPick:null,round:null,teamCount:null};const r=send(s,frame(2,c));assert.deepEqual(r.session.draftPicks,s.draftPicks);assert.equal(r.session.bridge.extraction,'unsupported');});
test('Yahoo eligibility overrides projection positions without changing statistics',()=>{const {applyYahooEligibility}=load('src/lib/draft/yahooV2.ts');const p={id:'p',positions:['C'],points:70};const result=applyYahooEligibility([p],[{source:'yahoo',projectionId:'p',positions:['C','LW']}]);assert.deepEqual(result[0].positions,['C','LW']);assert.equal(result[0].points,70);});
test('synthetic 192-pick replay preserves every number, unknown and goalie through snake rounds',()=>{
 let s=send(session(),frame()).session;
 const full=structuredClone(capture);let sequence=1;
 for(let n=19;n<=192;n++){
  const round=Math.floor((n-1)/12)+1,offset=(n-1)%12,slot=round%2?offset+1:12-offset;
  full.rows.push({pickNumber:n,round,playerName:`Synthetic test player ${n}`,yahooPlayerId:String(500000+n),positions:n%7===0?['G']:['D'],nhlTeam:'TBL',ownerName:`Owner ${slot}`});
  full.currentPick=n===192?192:n+1;full.round=Math.floor((full.currentPick-1)/12)+1;
  full.coverage=n===192?'partial':'complete'; // Final-header semantics are not in the real fixture.
  const f=frame(++sequence,structuredClone(full));s=send(s,f).session;s=parseSession(JSON.stringify(s));
  const duplicate=send(s,f);assert.equal(duplicate.status,'replayed');s=duplicate.session;
  if(n%9===0)s=send(s,frame()).session;
  assert.equal(nextPickNumber(s.draftPicks),n+1);assert.equal(s.draftPicks[n-1].fantasyTeamId,`team-${slot}`);
 }
 assert.equal(s.draftPicks.length,192);assert.equal(s.bridge.coverage,'partial');
});
