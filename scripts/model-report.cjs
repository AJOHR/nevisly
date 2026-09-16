/* eslint-disable @typescript-eslint/no-require-imports -- Node comparison harness uses the test loader. */
/* Deterministic, synthetic ranking changes; no licensed projection data. */
const {performance}=require('node:perf_hooks');
const {load}=require('../tests/load.cjs');
const {players,context}=require('../tests/model-scenarios.cjs');
const legacy=load('src/lib/model/legacy.ts');
const {replacementValues}=load('src/lib/model/replacement.ts');
const {fitStage}=load('src/lib/model/fitStage.ts');
const {rankRecommendations}=load('src/lib/model/engine.ts');
const {initializeRankedPlayer}=load('src/lib/model/player.ts');
const stages=[];
const oldBase=legacy.legacyBase(players,12), market=replacementValues(players,12);
const order=rows=>rows.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
const time=fn=>{const start=performance.now();const result=fn();return {result,ms:+(performance.now()-start).toFixed(2)}};
for(const picks of [0,24,60,100]) {
 const prior=context(oldBase,picks),next=context(market.ranked,picks);
 const old=time(()=>legacy.legacyFinal(prior)),replacement=time(()=>legacy.legacyFinal(next)),fit=time(()=>fitStage(next));
 const optimized={...next,rankedPlayers:market.ranked.map(initializeRankedPlayer)};
 const final=time(()=>rankRecommendations(optimized,market));
 const rows=[old,replacement,fit,final].map(({result,ms})=>({ms,rows:order(result.filter(p=>!next.draftedIds.has(p.id)))}));
 const baseline=rows[0].rows;
 const top=rows.map(x=>x.rows.slice(0,10).map(p=>p.id));
 const ablations={};
 for(const term of ['breadth','powerForward','age','roundStrategy','scarcity','tier','flexibility']) {
  const adjusted=order(rows[2].rows.map(p=>({...p,score:p.score-(p.contributions[term]??0)}))).slice(0,10).map(p=>p.id);
  ablations[term]={changedTop10Positions:adjusted.filter((id,i)=>id!==top[2][i]).length,minContribution:Math.min(...rows[2].rows.map(p=>p.contributions[term]??0)),maxContribution:Math.max(...rows[2].rows.map(p=>p.contributions[term]??0))};
 }
 stages.push({picks,stages:rows.map((r,i)=>({name:['production','allocation','categoryFit','consolidated'][i],ms:r.ms,top10:top[i],top3:r.rows.slice(0,3).map(p=>({name:p.name,score:+p.score.toFixed(4)})),meanAbsoluteRankShift:+(r.rows.reduce((n,p,j)=>n+Math.abs(baseline.findIndex(b=>b.id===p.id)-j),0)/r.rows.length).toFixed(2)})),ablations});
}
console.log(JSON.stringify({fixture:'300 synthetic skaters; 12 teams; C2/LW2/RW2/D4/G2/BN4; no schedule data',stages},null,2));
