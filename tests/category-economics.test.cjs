const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./load.cjs'),{players,context}=require('./model-scenarios.cjs');
const {replacementValues}=load('src/lib/model/replacement.ts');
const {categories,modelConfig,positionalReplacementWeight}=load('src/lib/model/config.ts');
const {categoryUtilityGain}=load('src/lib/model/categoryUtility.ts');
const {rankRecommendations}=load('src/lib/model/engine.ts');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const pool=players.map(p=>({...p,...Object.fromEntries(categories.map(c=>[c,p[c]*.65]))}));
const profiles=[{...pool[0],id:'profile-a',name:'Synthetic multi-category forward',positions:['C','LW'],goals:29,assists:36,points:65,ppp:20,sog:274,hits:218,blocks:31},
 {...pool[0],id:'profile-b',name:'Synthetic two-way defender',positions:['D'],goals:10,assists:45,points:56,ppp:26,sog:172,hits:172,blocks:191}];
test('8-team profile decomposition explains raw category scaling, real replacement and bounded value',t=>{
 const m=replacementValues([...pool,...profiles],8);
 for(const input of profiles){
  const p=m.ranked.find(p=>p.id===input.id),r=m.ranked.find(q=>q.id===p.replacementId);
  const old=Object.fromEntries(categories.map(c=>[c,(p[c]-r[c])/m.deviations[c]]));
  near(Object.values(old).reduce((a,b)=>a+b,0),p.rawScore-r.rawScore);
  near(Object.values(p.valueContributions).reduce((a,b)=>a+b,0),p.vor);
  near(Object.values(p.positionalValueContributions).reduce((a,b)=>a+b,0),p.positionalVor);
  near(Object.values(p.overallValueContributions).reduce((a,b)=>a+b,0),p.overallVor);
  for(const c of categories){
   near(p.positionalValueContributions[c],categoryUtilityGain(0,old[c],modelConfig.categoryWidth));
   near(p.valueContributions[c],
    positionalReplacementWeight*p.positionalValueContributions[c]+
    (1-positionalReplacementWeight)*p.overallValueContributions[c]);
  }
  near(p.vor,positionalReplacementWeight*p.positionalVor+(1-positionalReplacementWeight)*p.overallVor);
  t.diagnostic(JSON.stringify({profile:p.id,replacement:r.id,old,oldTotal:p.rawScore-r.rawScore,
   positional:p.positionalVor,overall:p.overallVor,blended:p.vor}));
 }
 const reversed=replacementValues([...pool,...profiles].reverse(),8);
 assert.deepEqual(m.ranked.map(p=>[p.id,p.vor,p.valueContributions]),reversed.ranked.map(p=>[p.id,p.vor,p.valueContributions]));
 const defender=m.ranked.find(p=>p.id==='profile-b');
 assert.ok(defender.positionalVor>defender.vor,'overall replacement should damp a weak positional fringe');
 assert.ok(defender.vor>defender.overallVor,'real positional scarcity must still retain weight');
});
test('narrow reference category cannot create millions of utility points in value or empty-roster fit',()=>{
 const narrow=players.map((p,i)=>({...p,blocks:30+i%2*.001}));
 const extreme={...profiles[0],id:'extreme',points:1,blocks:1000};
 const market=replacementValues([...narrow,extreme],8),p=market.ranked.find(p=>p.id==='extreme');
 const r=market.ranked.find(q=>q.id===p.replacementId);
 assert.ok((p.blocks-r.blocks)/market.deviations.blocks>1000000);
 assert.ok(p.valueContributions.blocks<=modelConfig.categoryWidth);
 assert.ok(p.valueContributions.blocks>3);
 const ctx={...context(market.ranked),leagueTeams:8,fantasyTeams:context(market.ranked).fantasyTeams.slice(0,8)};
 const recommendation=rankRecommendations(ctx,market).find(p=>p.id==='extreme');
 for(const detail of Object.values(recommendation.fit.categories))assert.ok(Math.abs(detail.neutralGain)<=modelConfig.categoryWidth);
 assert.ok(Number.isFinite(recommendation.score));
});
test('seven category objectives use the same increasing bounded utility, including G/P/PPP and peripherals',()=>{
 for(const c of categories){
  const gains=[0,.1,1,3,10,100].map(x=>categoryUtilityGain(0,x,modelConfig.categoryWidth));
  assert.equal(gains[0],0,c);assert.ok(gains[2]>.9,c);
  for(let i=1;i<gains.length;i++)assert.ok(gains[i]>=gains[i-1],c);
  assert.ok(gains.at(-1)<=modelConfig.categoryWidth,c);
 }
 // A maximum single-category advantage cannot exceed two material category gains.
 assert.ok(categoryUtilityGain(0,1e8,modelConfig.categoryWidth)<2*categoryUtilityGain(0,2,modelConfig.categoryWidth));
});
test('bounded utility does not depend on position labels, and retains shallow/deep replacement economics',()=>{
 const out=[];
 for(const size of [8,10,12]){
  const m=replacementValues([...pool,...profiles],size);out.push(m);
  assert.equal(m.allocated.size,size*10);
  for(const p of m.ranked)assert.ok(Number.isFinite(p.vor));
 }
 const replacementRaw=m=>{const p=m.ranked.find(p=>p.id==='profile-b');return m.ranked.find(q=>q.id===p.replacementId).rawScore;};
 assert.ok(replacementRaw(out[0])>replacementRaw(out[2]));
 assert.ok(replacementRaw(out[1])>=replacementRaw(out[2]));
 // Rename the complete C/LW/RW/D economy without changing slot demand.
 const rename={C:'D',LW:'RW',RW:'LW',D:'C'};
 const remapped=replacementValues([...pool,...profiles].map(p=>({...p,positions:p.positions.map(x=>rename[x])})),8,
  {...modelConfig,starters:Object.fromEntries(Object.entries(modelConfig.starters).map(([p,n])=>[rename[p],n]))});
 for(const p of out[0].ranked)near(p.vor,remapped.ranked.find(q=>q.id===p.id).vor);
});
test('two-step neutral utility has a fixed origin: the same category gain is not rewarded twice',()=>{
 const w=modelConfig.categoryWidth;
 for(const [a,b] of [[2,3],[100,100],[-2,4]])near(categoryUtilityGain(0,a,w)+categoryUtilityGain(a,b,w),categoryUtilityGain(0,a+b,w));
});
test('broad elite production can beat a peripheral specialist, and truly elite all-category production can beat both',()=>{
 const sum=gains=>gains.reduce((n,g)=>n+categoryUtilityGain(0,g,modelConfig.categoryWidth),0);
 const broad=[3,2,3,2,3,2,.2],peripheral=[.2,1,1,1,1,1,3],elite=[2,3,3,3,2,3,3];
 assert.ok(sum(broad)>sum(peripheral));assert.ok(sum(elite)>sum(broad));
 // No position argument or offense-correlation discount enters these sums.
 near(sum([1,1,1,1,1,1,1]),7*categoryUtilityGain(0,1,modelConfig.categoryWidth));
});
