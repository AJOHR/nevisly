const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./load.cjs');
const {applyYahooMessage}=load('src/lib/draft/yahoo.ts');
const {DEFAULT_SESSION,parseSession}=load('src/lib/session/session.ts');
const {nextPickNumber}=load('src/lib/draft/state.ts');
const player={id:'projected-a',name:'Adam Smith',team:'TBL',positions:['C']};
const pick=(n,name='Adam Smith',extra={})=>({pickNumber:n,playerName:name,nhlTeam:'TBL',positions:['C'],...extra});
const envelope=(sequence,kind,data)=>({schemaVersion:1,draftSessionId:'draft-A',sequence,kind,...data});
const send=(session,data,kind='pick',players=[])=>applyYahooMessage(session,data,kind,players,1000);

test('same-revision snapshot retains a previously accepted incremental pick',()=>{
 const s=send(DEFAULT_SESSION,envelope(10,'pick',{pick:pick(1)}));
 const result=send(s,envelope(10,'snapshot',{complete:true,picks:[pick(1)]}),'snapshot');
 assert.equal(result.draftPicks.length,1);assert.equal(nextPickNumber(result.draftPicks),2);
});
test('contradictory same-revision pick is visibly rejected without mutation',()=>{
 const s=send(DEFAULT_SESSION,envelope(10,'pick',{pick:pick(1)}));
 const result=send(s,envelope(10,'pick',{pick:pick(1,'Other Person')}));
 assert.deepEqual(result.draftPicks,s.draftPicks);assert.equal(result.sync.status,'ERROR');
});
test('contradictory same-revision snapshot is rejected even after refresh',()=>{
 const s=send(DEFAULT_SESSION,envelope(10,'snapshot',{complete:true,picks:[pick(1)]}),'snapshot');
 const restored=parseSession(JSON.stringify(s));
 const result=send(restored,envelope(10,'snapshot',{complete:true,picks:[pick(1,'Other Person')]}),'snapshot');
 assert.deepEqual(result.draftPicks,restored.draftPicks);assert.equal(result.sync.status,'ERROR');
});
test('selection identity survives projection enrichment of legacy input',()=>{
 const s=send(DEFAULT_SESSION,pick(1));
 assert.ok(s.draftPicks[0].selectionId);assert.equal(s.draftPicks[0].projectionId,undefined);
 const result=send(s,[pick(1)],'snapshot',[player]);
 assert.equal(result.draftPicks[0].selectionId,s.draftPicks[0].selectionId);
 assert.equal(result.draftPicks[0].projectionId,player.id);
 assert.equal(result.draftPicks[0].pickNumber,1);
});
test('stale legacy name cannot replace unresolved selection metadata',()=>{
 const s=send(DEFAULT_SESSION,pick(1,'Current Name'));
 const result=send(s,[pick(1,'Old Name')],'snapshot');
 assert.deepEqual(result.draftPicks,s.draftPicks);
});
test('a valid observed ordinal survives absent descriptive fields',()=>{
 const s=send(DEFAULT_SESSION,{pickNumber:12});
 assert.equal(s.draftPicks[0]?.pickNumber,12);assert.equal(nextPickNumber(s.draftPicks),13);
 assert.equal(s.draftPicks[0].yahooPlayerId,undefined);
});
test('projection collisions cannot erase distinct observed selection slots',()=>{
 const s=send(DEFAULT_SESSION,[pick(1),pick(2)],'snapshot',[player]);
 assert.deepEqual(s.draftPicks.map(p=>p.pickNumber),[1,2]);
 assert.ok(s.draftPicks.every(p=>!p.projectionId));
 assert.equal(new Set(s.draftPicks.map(p=>p.selectionId)).size,2);
});
test('legacy matching uncertainty and extraction/coverage health are distinct',()=>{
 const s=send(DEFAULT_SESSION,pick(1));
 assert.equal(s.sync.health.extraction,'unverified');
 assert.equal(s.sync.health.history,'unverified');
 assert.equal(s.sync.health.unmatchedSelections,1);
});
test('self-declared contiguous v1 snapshot cannot establish verified healthy coverage',()=>{
 const s=send(DEFAULT_SESSION,envelope(1,'snapshot',{complete:true,picks:[pick(1)]}),'snapshot',[player]);
 assert.notEqual(s.sync.status,'LIVE');assert.equal(s.sync.health.history,'unverified');
});

test('projection upload can relink a selection without another Yahoo message',()=>{
 const {refreshProjectionLinks}=load('src/lib/draft/yahoo.ts');
 const s=send(DEFAULT_SESSION,pick(1));
 const result=refreshProjectionLinks(s,[player]);
 assert.equal(result.draftPicks[0].selectionId,s.draftPicks[0].selectionId);
 assert.equal(result.draftPicks[0].projectionId,player.id);
 assert.deepEqual(result.sync.pickFingerprints,s.sync.pickFingerprints);
});

test('explicit correction keeps selection identity while replacing the projection link',()=>{
 const other={...player,id:'b',name:'Other Person'};
 const s=send(DEFAULT_SESSION,envelope(1,'snapshot',{complete:true,picks:[pick(1),pick(2,'Goalie',{positions:['G']})]}),'snapshot',[player,other]);
 const result=send(s,envelope(2,'snapshot',{complete:true,picks:[pick(1,'Other Person'),pick(2,'Goalie',{positions:['G']})]}),'snapshot',[player,other]);
 assert.equal(result.draftPicks[0].selectionId,s.draftPicks[0].selectionId);
 assert.equal(result.draftPicks[0].projectionId,'b');assert.deepEqual(result.draftPicks[1],s.draftPicks[1]);
});
test('projection removal and restoration never alter selection or Yahoo ownership',()=>{
 const {refreshProjectionLinks}=load('src/lib/draft/yahoo.ts');
 const s=send(DEFAULT_SESSION,pick(12,'Adam Smith',{fantasyTeamId:'team-4',yahooPlayerId:'actual-key'}),'pick',[player]);
 const unlinked=refreshProjectionLinks(s,[]),linked=refreshProjectionLinks(unlinked,[player]);
 assert.equal(unlinked.draftPicks[0].projectionId,undefined);
 assert.equal(linked.draftPicks[0].selectionId,s.draftPicks[0].selectionId);
 assert.equal(linked.draftPicks[0].fantasyTeamId,'team-4');assert.equal(linked.draftPicks[0].yahooPlayerId,'actual-key');
});
test('deterministic event replay converges through duplicates, reorder and persistence',()=>{
 const frames=[
  ['pick',envelope(10,'pick',{pick:pick(1)})],
  ['pick',envelope(11,'pick',{pick:pick(2,'Goalie',{positions:['G']})})],
  ['snapshot',envelope(12,'snapshot',{complete:true,picks:[pick(1),pick(2,'Goalie',{positions:['G']})]})],
  ['pick',envelope(13,'pick',{pick:pick(3,'Unknown Person')})],
 ];
 function permutations(a){return a.length?a.flatMap((x,i)=>permutations(a.filter((_,j)=>i!==j)).map(t=>[x,...t])):[[]];}
 let expected;
 for(const order of permutations(frames)){
  let s=DEFAULT_SESSION;
  for(const [kind,frame] of order){s=send(s,frame,kind,[player]);s=parseSession(JSON.stringify(s));s=send(s,frame,kind,[player]);}
  const ledger=JSON.stringify(s.draftPicks);
  if(expected===undefined)expected=ledger;else assert.equal(ledger,expected);
  assert.deepEqual(s.draftPicks.map(p=>p.pickNumber),[1,2,3]);assert.equal(nextPickNumber(s.draftPicks),4);
 }
});
test('replay evidence corruption is rejected on reload',()=>{
 const s=send(DEFAULT_SESSION,envelope(1,'pick',{pick:pick(1)}));
 s.sync.pickFingerprints={'1':{bad:true}};
 assert.throws(()=>parseSession(JSON.stringify(s)),/replay evidence/);
});
test('manual correction retains its local selection identity and later pick numbers',()=>{
 const {draftReducer}=load('src/lib/draft/state.ts');
 let picks=draftReducer([],{type:'record',pick:{playerId:'manual-p',pickNumber:1,fantasyTeamId:'team-1'}});
 const id=picks[0].selectionId;
 picks=draftReducer(picks,{type:'record',pick:{playerId:'later',pickNumber:4,fantasyTeamId:'team-4'}});
 picks=draftReducer(picks,{type:'correct',pick:{playerId:'replacement',pickNumber:1,fantasyTeamId:'team-2'}});
 assert.equal(picks[0].selectionId,id);assert.equal(picks[1].pickNumber,4);
});
