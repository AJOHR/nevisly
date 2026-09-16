const {load}=require('./load.cjs'),{test}=require('node:test'),assert=require('node:assert/strict');
const {rankRecommendations}=load('src/lib/model/engine.ts'),{replacementValues}=load('src/lib/model/replacement.ts');
const {players,context}=require('./model-scenarios.cjs');
function run(ps=players,n=0){const market=replacementValues(ps,12);return rankRecommendations(context(market.ranked,n),market);}
test('new model exposes only intrinsic value plus roster/category fit in recommendation score',()=>{
 for(const p of run()){
  assert.ok(Number.isFinite(p.score));assert.ok(Math.abs(p.score-p.decision.playerValue.score-p.decision.teamFit.adjustment)<1e-10);
  assert.ok(Math.abs(p.score-Object.values(p.contributions).reduce((a,b)=>a+b,0))<1e-10);
  for(const term of ['age','breadth','powerForward','roundStrategy','scarcity','flexibility','h2h','categoryNeed'])assert.equal(term in p.contributions,false);
  assert.equal(p.decision.draftUrgency.calibrated,false);
 }
});
test('identical projections do not get a second age penalty or rank changes from unknown age',()=>{
 const base=run();const older=run(players.map(p=>({...p,age:40})));
 assert.deepEqual(base.map(p=>[p.id,p.score]),older.map(p=>[p.id,p.score]));
 const unknown=run(players.map(p=>({...p,missingFields:['age']})));assert.deepEqual(base.map(p=>[p.id,p.score]),unknown.map(p=>[p.id,p.score]));
});
test('premium defense and elite forwards beat low-output alternatives without forced round bonuses',()=>{
 const out=run(),rank=id=>out.findIndex(p=>p.id===id);
 assert.ok(rank('p003')<rank('p283'));assert.ok(rank('p000')<rank('p280'));
 assert.ok(rank('p005')<rank('p009'),'offense plus hits outranks a low-offense hits specialist in empty-roster fixture');
});
test('stable ties and reversed inputs produce identical scores and ranks',()=>{
 assert.deepEqual(run().map(p=>[p.id,p.score]),run([...players].reverse()).map(p=>[p.id,p.score]));
 const tied=players.map(p=>({...p,goals:10,assists:10,points:20,ppp:5,sog:80,hits:50,blocks:50}));
 const out=run(tied);assert.deepEqual(out.map(p=>p.id),out.map(p=>p.id).sort());
});
test('strong single-category additions improve a close category more than a saturated lead',()=>{
 const {prepareCategoryFit}=load('src/lib/model/categoryFit.ts');
 const {modelConfig}=load('src/lib/model/config.ts');
 // Inspect smooth utility directly through identical full-roster production deltas at different margins.
 const m=replacementValues(players,12),own=players.slice(20,25).map((p,i)=>({id:`s${i}`,projectionId:p.id,teamId:'team-1',ordinal:i+1,positions:p.positions}));
 const f=prepareCategoryFit({players:m.ranked,reserves:m.reserves,market:m.allocated,deviations:m.deviations,selections:own,teams:require('./model-scenarios.cjs').teams});
 const a=f(m.ranked.find(p=>p.id==='p005'));
 assert.ok(Object.values(a.categories).every(c=>Number.isFinite(c.adjustment)));
 const {categoryUtilityGain}=load('src/lib/model/categoryFit.ts');
 assert.ok(categoryUtilityGain(0,1,modelConfig.categoryWidth)>categoryUtilityGain(15,1,modelConfig.categoryWidth));
});

test('urgency changes with turn distance without altering Player Value or recommendation order',()=>{
 const market=replacementValues(players,12),ctx=context(market.ranked,0);
 const a=rankRecommendations({...ctx,myDraftSlot:1},market),b=rankRecommendations({...ctx,myDraftSlot:12},market);
 assert.deepEqual(a.map(p=>[p.id,p.score,p.decision.playerValue.score]),b.map(p=>[p.id,p.score,p.decision.playerValue.score]));
 assert.ok(b.some((p,i)=>p.decision.draftUrgency.level!==a[i].decision.draftUrgency.level));
});
test('projection disagreement and archetype labels remain notes, never hidden score bonuses',()=>{
 const base=run(),metadata=run(players.map(p=>({...p,name:'Power forward',projectionSources:3,projectionVariance:99,projectionConfidence:'LOW'})));
 assert.deepEqual(base.map(p=>[p.id,p.score]),metadata.map(p=>[p.id,p.score]));
});
test('an elite forward beats a mediocre defenseman despite the four-D requirement',()=>{
 const output=run();
 assert.ok(output.findIndex(p=>p.id==='p000')<output.findIndex(p=>p.id==='p163'));
 const d=output.find(p=>p.id==='p003');
 assert.ok(d.fit.replacementNames.length>0);
 assert.equal(d.contributions.scarcity,undefined);
 assert.equal(d.contributions.roundStrategy,undefined);
});
test('early category fit is zero for an empty roster and shrunk to 20 percent with one known skater',()=>{
 const {prepareCategoryFit,canonicalSelections}=load('src/lib/model/categoryFit.ts');
 const market=replacementValues(players,12),teams=require('./model-scenarios.cjs').teams;
 for(const count of [0,1]){
  const selections=canonicalSelections(players.slice(0,count).map((p,i)=>({playerId:p.id,pickNumber:i+1,fantasyTeamId:'team-1'})));
  const evaluate=prepareCategoryFit({players:market.ranked,reserves:market.reserves,market:market.allocated,deviations:market.deviations,selections,teams});
  for(const player of market.ranked)for(const c of Object.values(evaluate(player).categories))assert.ok(Math.abs(c.adjustment)<=count*.2*Math.abs(c.productionGain)+1e-9);
 }
});
