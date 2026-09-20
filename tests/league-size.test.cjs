const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {load}=require('./load.cjs');
const {replacementValues,normalizeProjections}=load('src/lib/model/replacement.ts');
const {modelConfig,rosterSelectionCapacity}=load('src/lib/model/config.ts');
const {DEFAULT_SESSION,createSessionStore}=load('src/lib/session/session.ts');
const {DEFAULT_LEAGUE_TEAMS,LEAGUE_TEAM_OPTIONS}=load('src/lib/league.ts');
const {rankRecommendations,availableRecommendationRanks}=load('src/lib/model/engine.ts');
const {players:fixture,context}=require('./model-scenarios.cjs');
// Identical category proportions within each role make actual replacement
// production comparable even though normalization units change with depth.
const players=Array.from({length:400},(_,i)=>{
 const tier=Math.floor(i/4),position=['C','LW','RW','D'][i%4],production=110-tier;
 return {...fixture[0],id:`size-${i}`,name:`Synthetic ${i}`,positions:[position],goals:production,assists:production,points:production*2,ppp:production,sog:production*4,hits:production,blocks:production};
});
const markets=new Map([8,10,12].map(n=>[n,replacementValues(players,n)]));
test('league demand and unique roster-proportional reference depth scale at 8/10/12 teams',()=>{
 for(const [n,reference] of [[8,167],[10,208],[12,250]]){
  const m=markets.get(n);assert.equal(m.referenceSize,reference);assert.equal(m.allocated.size,n*10);
  assert.equal(new Set([...m.allocated.values()].map(p=>p.id)).size,n*10);
  assert.equal([...m.allocated.keys()].filter(k=>k.startsWith('D')).length,n*4);
  assert.equal(n*rosterSelectionCapacity,n*16); // No IR+ draft demand.
  assert.equal(m.reserves.length,400-n*10);
 }
});
test('smaller leagues have stronger actual feasible replacement production',()=>{
 for(const id of ['size-0','size-1','size-2','size-3']){
  const replacements=[8,10,12].map(n=>{const m=markets.get(n),p=m.ranked.find(p=>p.id===id);return m.ranked.find(r=>r.id===p.replacementId).points;});
  assert.ok(replacements[0]>replacements[1]&&replacements[1]>replacements[2]);
 }
});
test('12-team reference preserves PR7 calculations exactly',()=>{
 const implicit=normalizeProjections(players),explicit=normalizeProjections(players,modelConfig,12);
 assert.deepEqual(implicit,explicit);assert.equal(explicit.referenceSize,250);
 // Frozen PR7 roster quotas: 50 C/LW/RW and 100 D, selected by points.
 const reference=players.filter(p=>Number(p.id.split('-')[1])/4<(p.positions[0]==='D'?100:50));
 const mean=reference.reduce((s,p)=>s+p.points,0)/250;
 assert.equal(explicit.means.points,mean);
});
test('ordinary league-size input recomputes scores/ranks without position bonuses or urgency contamination',()=>{
 const results=[8,10,12].map(n=>{
  const c=context(markets.get(n).ranked);c.leagueTeams=n;c.fantasyTeams=c.fantasyTeams.slice(0,n);
  const result=rankRecommendations(c,markets.get(n)),ranks=availableRecommendationRanks(result,new Set());
  result.forEach((p,i)=>{assert.equal(ranks.get(p.id),i+1);assert.ok(Number.isFinite(p.score));assert.equal(p.scarcityBonus,0);assert.equal(p.tierScarcityBonus,0);assert.equal(p.decision.playerValue.score,p.vor);});
  return result;
 });
 assert.notEqual(results[0].find(p=>p.id==='size-0').score,results[2].find(p=>p.id==='size-0').score);
});
test('existing session persistence retains every supported league size and defaults to 12',()=>{
 assert.equal(DEFAULT_SESSION.leagueTeams,DEFAULT_LEAGUE_TEAMS);assert.equal(DEFAULT_LEAGUE_TEAMS,12);
 for(const n of [8,9,10,11,12]){
  assert.ok(LEAGUE_TEAM_OPTIONS.includes(n));const saved=new Map(),storage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)};
  const store=createSessionStore(storage);store.update(s=>({...s,leagueTeams:n,myDraftSlot:n}));
  assert.equal(createSessionStore(storage).getSnapshot().data.leagueTeams,n);
  assert.equal(createSessionStore(storage).getSnapshot().data.myDraftSlot,n);
 }
});
test('existing UI setting invalidates the market and recommendation memo, retaining recorded-pick protection',()=>{
 const source=fs.readFileSync('src/components/ProjectionUpload.tsx','utf8');
 assert.match(source,/LEAGUE_TEAM_OPTIONS\.map/);assert.match(source,/aria-label="League size"/);
 assert.match(source,/replacementValues\(players, leagueTeams\), \[players, leagueTeams\]/);
 assert.match(source,/rankRecommendations\([\s\S]*?\[\s*[\s\S]*?leagueTeams,/);
 assert.match(source,/if \(draftPicks.length\).*Start a new draft before changing league size/);
 assert.match(source,/session.update\(s=>\(\{\.\.\.s,leagueTeams:teamCount,myDraftSlot:Math.min\(s.myDraftSlot,teamCount\)/);
});
