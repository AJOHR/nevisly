const {load}=require('./load.cjs'),{test}=require('node:test'),assert=require('node:assert/strict');
const {allocate,rosterSlots}=load('src/lib/model/allocation.ts');
const {replacementValues,normalizeProjections}=load('src/lib/model/replacement.ts');
const {players}=require('./model-scenarios.cjs');
test('multi-position allocation assigns each player once and moves flexible players',()=>{
 const roster=allocate([{id:'flex',positions:['C','LW'],rawScore:10},{id:'c',positions:['C'],rawScore:9},{id:'lw',positions:['LW'],rawScore:1}],rosterSlots({C:1,LW:1}));
 assert.deepEqual([...roster.values()].map(p=>p.id).sort(),['c','flex']);assert.equal(roster.get('LW1').id,'flex');
});
test('allocation equals exhaustive optimal assignment on small pools',()=>{
 for(let seed=0;seed<30;seed++){
  const ps=Array.from({length:6},(_,i)=>({id:`${i}`,positions:[['C'],['LW'],['C','LW']][(i+seed)%3],rawScore:(seed*17+i*13)%23-12}));
  const slots=rosterSlots({C:1,LW:1});const result=[...allocate(ps,slots).values()].reduce((s,p)=>s+p.rawScore,0);
  const best=Math.max(...ps.flatMap(a=>ps.filter(b=>b.id!==a.id&&a.positions.includes('C')&&b.positions.includes('LW')).map(b=>a.rawScore+b.rawScore)));
  assert.equal(result,best);
 }
});
test('market allocation has 120 unique starters and real distinct exchange replacements',()=>{
 const r=replacementValues(players,12);assert.equal(r.allocated.size,120);assert.equal(new Set([...r.allocated.values()].map(p=>p.id)).size,120);
 for(const p of r.ranked){assert.ok(Number.isFinite(p.vor));assert.notEqual(p.id,p.replacementId);assert.ok(p.replacementAvailable);}
 assert.ok(r.ranked.find(p=>p.id==='p003').vor>0);assert.ok(r.ranked.find(p=>p.id==='p000').vor>0);
});
test('normalization and VOR are exactly invariant to input and eligibility order',()=>{
 const a=replacementValues(players,12).ranked;
 const b=replacementValues([...players].reverse().map(p=>({...p,positions:[...p.positions].reverse()})),12).ranked;
 assert.deepEqual(a.map(p=>[p.id,p.rawScore,p.vor,p.replacementId]),b.map(p=>[p.id,p.rawScore,p.vor,p.replacementId]));
});
test('missing scoring data is excluded; legitimate zero and optional unknown metadata remain',()=>{
 const zero={...players[0],id:'zero',goals:0,missingFields:['age']};
 const missing={...zero,id:'missing',missingFields:['goals']};
 assert.deepEqual(normalizeProjections([missing,zero]).ranked.map(p=>p.id),['zero']);
 assert.equal(replacementValues([],12).ranked.length,0);
 assert.equal(replacementValues([zero],12).ranked[0].replacementAvailable,false);
});
