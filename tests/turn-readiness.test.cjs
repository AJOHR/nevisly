const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./load.cjs'),{players,context}=require('./model-scenarios.cjs');
const {getNextTurn,getSnakeTeamIdForPick}=load('src/lib/draft/state.ts');
const {replacementValues}=load('src/lib/model/replacement.ts');
const engine=load('src/lib/model/engine.ts');
const {snapshotFor}=require('./market-fixture.cjs');
const rankRecommendations=(ctx,m)=>engine.rankRecommendations(ctx,m,snapshotFor(ctx.rankedPlayers));
const {availableRecommendationRanks}=engine;
const {categories}=load('src/lib/model/config.ts');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const market=replacementValues(players,10);
const picks=n=>Array.from({length:n},(_,i)=>({playerId:`unknown-${i}`,pickNumber:i+1,fantasyTeamId:getSnakeTeamIdForPick(i+1,10),positions:i%2?['G']:[]}));
const ctx=(slot,recorded=[])=>({...context(market.ranked),leagueTeams:10,myDraftSlot:slot,draftPicks:recorded,
 fantasyTeams:Array.from({length:10},(_,i)=>({id:`team-${i+1}`,isMyTeam:i===slot-1}))});
test('10-team snake distinguishes pre-turn opponents from post-selection waits and both reversal boundaries',()=>{
 for(const [slot,onClock,next,count] of [[1,true,20,18],[3,false,3,2],[5,false,5,4],[10,false,10,9]]) {
  const t=getNextTurn([],10,slot);assert.equal(t.currentPick,1);assert.equal(t.onClock,onClock);assert.equal(t.nextMyPick,next);assert.equal(t.opponentTeamIds.length,count);
 }
 for(const [slot,at,next,count] of [[3,3,18,14],[5,5,16,10],[10,10,11,0],[10,11,30,18],[1,20,21,0],[1,21,40,18]]) {
  const before=getNextTurn(picks(at-1),10,slot),after=getNextTurn(picks(at),10,slot);
  assert.equal(before.onClock,true);assert.equal(before.nextMyPick,next);assert.equal(before.opponentTeamIds.length,count);
  assert.equal(after.currentPick,at+1);
  if(count){assert.equal(after.onClock,false);assert.equal(after.nextMyPick,next);assert.deepEqual(after.opponentTeamIds,before.opponentTeamIds);}
 }
});
test('off-clock slots retain identical scores/ranks; pre-turn urgency remains informational',()=>{
 const boards=[3,5,10].map(slot=>rankRecommendations(ctx(slot),market));
 for(const b of boards){
  assert.deepEqual(b.map(p=>[p.id,p.vor,p.decision.teamFit.adjustment,p.score]),boards[0].map(p=>[p.id,p.vor,p.decision.teamFit.adjustment,p.score]));
  for(const p of b){assert.equal(p.decision.draftUrgency.adjustment,0);near(p.score,p.vor+p.decision.teamFit.adjustment);}
  const ix=id=>b.findIndex(p=>p.id===id);
  assert.ok(ix('p000')<ix('p280'));assert.ok(ix('p003')<ix('p283'));assert.ok(ix('p000')<ix('p163'));
 }
 assert.ok(boards[0].some(p=>p.decision.draftUrgency.level!==boards[1].find(q=>q.id===p.id).decision.draftUrgency.level));
});
test('on-clock slots use post-selection waits without changing intrinsic/current-roster value',()=>{
 const a=rankRecommendations(ctx(3,picks(2)),market),b=rankRecommendations(ctx(5,picks(4)),market);
 for(const p of a){const q=b.find(q=>q.id===p.id);near(p.vor,q.vor);near(p.decision.teamFit.adjustment,q.decision.teamFit.adjustment);assert.equal(p.picksUntilNext,14);assert.equal(q.picksUntilNext,10);}
 assert.ok(a.some(p=>Math.abs(p.decision.draftUrgency.adjustment-b.find(q=>q.id===p.id).decision.draftUrgency.adjustment)>1e-6));
 const consecutive=rankRecommendations(ctx(10,picks(9)),market);assert.ok(consecutive.every(p=>p.decision.draftUrgency.adjustment===0));
});
test('10-team empty, forward, defense, two-D, mixed and near-full states retain finite additive accounting',()=>{
 const states=[[],['p000'],['p003'],['p003','p007'],['p000','p001','p003','p006','p011'],['p000','p004','p001','p005','p002','p006','p003','p007','p011']];
 for(const ids of states){
  let n=0,owned=0;
  while(owned<ids.length){n++;if(getSnakeTeamIdForPick(n,10)==='team-5')owned++;}
  while(getSnakeTeamIdForPick(n+1,10)!=='team-5')n++;
  const recorded=picks(n);let index=0;
  for(const p of recorded)if(p.fantasyTeamId==='team-5'){const id=ids[index++];p.playerId=id;p.positions=players.find(q=>q.id===id).positions;}
  const out=rankRecommendations(ctx(5,recorded),market),taken=new Set(recorded.map(p=>p.playerId));
  const ranks=availableRecommendationRanks(out,taken);let rank=0;
  for(const p of out){
   assert.ok(Number.isFinite(p.score));near(p.score,p.vor+p.decision.teamFit.adjustment+p.decision.draftUrgency.adjustment);
   near(p.score,Object.values(p.contributions).reduce((a,b)=>a+b,0));
   near(p.vor,categories.reduce((sum,c)=>sum+market.ranked.find(q=>q.id===p.id).valueContributions[c],0));
   if(!taken.has(p.id))assert.equal(ranks.get(p.id),++rank);else assert.equal(ranks.has(p.id),false);
   if(!ids.length){near(p.fit.saturationAdjustment,0);if(p.fit.starterImprovement)near(p.decision.teamFit.adjustment,p.fit.rosterGain-p.vor);}
  }
 }
});
