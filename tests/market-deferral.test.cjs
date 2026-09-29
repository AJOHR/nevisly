const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./load.cjs');
const {prepareMarketDeferral,prepareNearTermScarcity}=load('src/lib/model/draftOpportunity.ts');
const {rankRecommendations}=load('src/lib/model/engine.ts');
const {replacementValues}=load('src/lib/model/replacement.ts');
const {getNextTurn}=load('src/lib/draft/state.ts');
const {players,context}=require('./model-scenarios.cjs');
const {snapshotFor}=require('./market-fixture.cjs');
const option=(id,score,pos='C')=>({id,score,vor:score,positions:[pos]});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
function fixture(pick,wait,adp,rank){
 const early=option('early',8.2,'LW'),late=option('late',8.8,'D'),other=option('other',6,'RW');
 const ids=Array.from({length:rank+2},(_,i)=>`external-${i}`);
 ids[0]=early.id;ids[wait]=other.id;ids[rank-1]=late.id;
 const pool=[early,late,other],adps=new Map([['early',pick-2],['late',adp],['other',pick+wait+1]]);
 return {pool,early,late,other,ids,adps,apply:prepareMarketDeferral(pool,pick,wait,ids,adps)};
}
test('pick 22/ADP 55.5 and pick 59/ADP 111.2 have bounded negative Timing despite positive path Timing',()=>{
 for(const [pick,wait,adp,rank] of [[22,16,55.5,34],[59,2,111.2,53]]){
  const f=fixture(pick,wait,adp,rank),margin=Math.min(adp-(pick+wait+1),rank-wait-1);
  const expected=(8.2-6)*margin/(margin+wait);
  for(const timing of [0,1.5]){
   const out=f.apply(f.late,timing);
   near(out.cost,expected);near(timing+out.adjustment,-expected);
   assert.ok(expected>0&&expected<2.2);
  }
  // A loss already represented by the planner is not charged a second time.
  assert.equal(f.apply(f.late,-3).adjustment,0);
 }
});
test('near-window, fallen, unknown and back-to-back candidates have no deferral cost',()=>{
 for(const pick of [22,39]){
  const f=fixture(pick,16,20,34);
  assert.equal(f.apply(f.late,1).adjustment,0);
 }
 for(const [adp,rank] of [[80,16],[80,17],[39,34]]){
  const f=fixture(22,16,adp,rank);assert.equal(f.apply(f.late,1).adjustment,0);
 }
 const f=fixture(22,16,55.5,34);
 assert.equal(f.apply(option('unknown',30),1).adjustment,0);
 assert.equal(prepareMarketDeferral(f.pool,22,16,f.ids,new Map())(f.late,1).adjustment,0);
 assert.equal(prepareMarketDeferral(f.pool,22,0,f.ids,f.adps)(f.late,1).adjustment,0);
 const only=[f.early,f.late];assert.equal(prepareMarketDeferral(only,22,16,f.ids,f.adps)(f.late,1).adjustment,0);
});
test('deferral uses actual alternative value, not position or arbitrary ADP points; a justified reach can still win',()=>{
 const f=fixture(22,16,55.5,34);
 const timing=f.apply(f.late,0).adjustment;
 assert.ok(f.late.score+timing<f.early.score);
 const dominant={...f.late,score:15};
 const apply=prepareMarketDeferral([f.early,dominant,f.other],22,16,f.ids,f.adps);
 assert.ok(dominant.score+apply(dominant,0).adjustment>f.early.score);
 const reversed=prepareMarketDeferral([...f.pool].reverse().map(p=>({...p,positions:['LW','RW','D']})),22,16,f.ids,f.adps);
 near(reversed(f.late,0).adjustment,timing);
 const equalAlternatives=prepareMarketDeferral([f.early,f.late,{...f.other,score:9}],22,16,f.ids,f.adps);
 assert.equal(equalAlternatives(f.late,1).adjustment,0);
 // Engine mutates final scores after preparation; the reference must be frozen.
 f.other.score=100;near(f.apply(f.late,0).adjustment,timing);
});
test('scarcity only rewards a known candidate actually removed before next turn',()=>{
 const f=fixture(22,16,55.5,34);
 const pool=[...f.pool,option('late-peer',2,'D'),option('early-peer',3,'LW')];
 const scarcity=prepareNearTermScarcity(pool,16,[...f.ids,'late-peer','early-peer']);
 assert.equal(scarcity(f.late).adjustment,0);
 assert.equal(scarcity(option('unknown',30,'LW')).adjustment,0);
 assert.ok(scarcity(f.early).adjustment>0);
 assert.equal(f.apply(f.early,2).adjustment,0); // Positive urgency remains intact.
});

const market=replacementValues(players,10),snapshot=snapshotFor(market.ranked);
function run(pick,id,adp,onClock=true){
 const target=players.find(p=>p.id===id);
 const s={...snapshot,players:snapshot.players.map(p=>({...p,adp:p.name===target.name?adp:p.adp}))};
 const ctx={...context(market.ranked),leagueTeams:10,myDraftSlot:onClock?2:3,
  fantasyTeams:Array.from({length:10},(_,i)=>({id:`team-${i+1}`,isMyTeam:i===1})),
  draftPicks:snapshot.players.filter(p=>p.name!==target.name).slice(0,pick-1).map((p,i)=>({playerId:`external-${i}`,yahooPlayerId:p.yahooPlayerId,pickNumber:i+1,fantasyTeamId:'team-3'}))};
 return {turn:getNextTurn(ctx.draftPicks,10,ctx.myDraftSlot),out:rankRecommendations(ctx,market,s)};
}
test('engine: synthetic late-market D/forward cases retain Value/Fit; current snake gaps and score accounting are exact',()=>{
 for(const [pick,id,adp,next,wait] of [[22,'p003',55.5,39,16],[59,'p012',111.2,62,2]]){
  const {turn,out}=run(pick,id,adp);assert.equal(turn.nextMyPick,next);assert.equal(turn.opponentTeamIds.length,wait);
  const p=out.find(p=>p.id===id),off=run(pick,id,adp,false).out.find(p=>p.id===id);
  assert.equal(p.returnRisk,'SAFE');assert.ok(p.decision.draftUrgency.adjustment<0);
  assert.equal(p.contributions.nearTermScarcity,0);
  assert.deepEqual(p.decision.playerValue,off.decision.playerValue);
  assert.deepEqual(p.decision.teamFit,off.decision.teamFit);
  assert.equal(off.decision.draftUrgency.adjustment,0);
  if(pick===22){
   const capped=out.filter(q=>q.contributions.marketDeferral<0);
   assert.ok(capped.length>0,'engine must apply the deferral ceiling, not merely expose a helper');
   for(const q of capped){
    assert.ok(q.decision.draftUrgency.adjustment<0);
    assert.equal(q.contributions.nearTermScarcity,0);
    assert.ok(q.explanations.some(r=>r.includes('Timing opportunity cost')));
   }
  }
  for(const q of out){
   near(q.score,q.decision.playerValue.score+q.decision.teamFit.adjustment+q.decision.draftUrgency.adjustment);
   near(q.score,Object.values(q.contributions).reduce((a,b)=>a+b,0));
  }
  for(let i=1;i<out.length;i++)assert.ok(out[i-1].score>=out[i].score);
 }
});
