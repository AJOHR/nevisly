const test=require('node:test');
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const {load}=require('./load.cjs');
const {players,context}=require('./model-scenarios.cjs');
const {replacementValues}=load('src/lib/model/replacement.ts');
const {rankRecommendations}=load('src/lib/model/engine.ts');
const {initializeRankedPlayer}=load('src/lib/model/player.ts');
const legacy=load('src/lib/model/legacy.ts');
test('cached market and removal of first-pass heuristics preserve every recommendation',()=>{
 const market=replacementValues(players,12);
 for(const count of [0,24,60,100]) {
  const ctx=context(market.ranked,count);
  const old=rankRecommendations(ctx);
  const next=rankRecommendations({...ctx,rankedPlayers:market.ranked.map(initializeRankedPlayer)},market);
  const view=rows=>rows.map(p=>({id:p.id,score:p.score,contributions:p.contributions,decision:p.decision,fit:p.fit,explanations:p.explanations}));
  assert.deepEqual(view(next),view(old));
 }
});
test('representative 600-player model performance and finite outputs',t=>{
 const pool=[...players,...players.map(p=>({...p,id:`extra-${p.id}`,points:p.points*.5,goals:p.goals*.5,assists:p.assists*.5}))];
 const start=performance.now(),market=replacementValues(pool,12),prepared=performance.now();
 const ctx=context(market.ranked,60);
 const optimized=rankRecommendations({...ctx,rankedPlayers:market.ranked.map(initializeRankedPlayer)},market);
 const elapsed=performance.now()-prepared;
 const oldStart=performance.now();legacy.legacyFinal(context(legacy.legacyBase(pool,12),60));
 t.diagnostic(JSON.stringify({players:pool.length,marketMs:prepared-start,rankingMs:elapsed,legacyMs:performance.now()-oldStart}));
 assert.equal(optimized.length,600);assert.ok(optimized.every(p=>Number.isFinite(p.score)));
 // Generous guard against accidental unbounded recomputation, not a microbenchmark.
 assert.ok(elapsed<5000);
});
