const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./load.cjs');
const {prepareDraftOpportunity}=load('src/lib/model/draftOpportunity.ts');
const {defaultMarketSnapshot,parseMarketSnapshot,matchMarketPlayers,prepareMarketDemand,marketTiming}=load('src/lib/model/marketDemand.ts');
const {rankRecommendations}=load('src/lib/model/engine.ts');
const {replacementValues}=load('src/lib/model/replacement.ts');
const {players,context}=require('./model-scenarios.cjs');
const {snapshotFor}=require('./market-fixture.cjs');
const row=(id,name,adp)=>({yahooPlayerId:String(id),name,adp,team:'OLD',positions:['C']});
const snap=rows=>({...defaultMarketSnapshot,players:rows});
const option=(id,score)=>({id,score,vor:score,positions:['C']});

test('dated Yahoo snapshot is valid; refresh rejects bad metadata, nonfinite ADP and duplicate identities',()=>{
 assert.equal(parseMarketSnapshot(defaultMarketSnapshot),defaultMarketSnapshot);
 assert.ok(defaultMarketSnapshot.players.some(p=>p.positions.includes('G')));
 for(const s of [snap([row(1,'A',0)]),snap([row(1,'A',NaN)]),snap([row(1,'A',2),row(1,'B',3)]),{...snap([row(1,'A',2)]),source:'unknown'}])assert.throws(()=>parseMarketSnapshot(s));
});
test('punctuation, accents, suffixes and team changes match; ambiguous normalized names never do',()=>{
 const ps=[{id:'a',name:'J.T. Éxample Jr.',team:'NEW'},{id:'b',name:'Other Name'},{id:'c',name:'Same Name'}];
 const s=snap([row(1,'JT Example',5),row(2,'Other Name',8),row(3,'Same Name',10),row(4,'Same Name Jr.',12)]);
 const m=matchMarketPlayers(ps,s);assert.equal(m.get('a').adp,5);assert.equal(m.get('b').adp,8);assert.equal(m.has('c'),false);
 assert.equal(matchMarketPlayers([{id:'a',name:'JT Example'},{id:'b',name:'J.T. Example'}],s).size,0);
});
test('two-pick choice follows market order, preserves later value, and permits a large justified reach',()=>{
 const early=option('early',8.2),later=option('later',8.8),depth=option('depth',2);
 const pool=[early,later,depth];
 // Pick 5 -> 16: ten opponent selections. Nine other market picks precede later.
 const demand=['early',...Array.from({length:9},(_,i)=>`external${i}`),'depth','later'];
 const plan=prepareDraftOpportunity(pool,10,()=>true,demand);
 assert.equal(plan(early,q=>q.score).alternative.id,'later');
 assert.notEqual(plan(later,q=>q.score).alternative?.id,'early');
 const a=early.score+plan(early,q=>q.score).adjustment,b=later.score+plan(later,q=>q.score).adjustment;
 assert.ok(a>b);
 // Materially better immediate production can justify reaching even if waiting
 // offers a two-pick pairing; no ADP penalty or prohibition is attached to it.
 const dominant={...later,score:30,vor:30};
 const reach=prepareDraftOpportunity([early,dominant,depth],10,()=>true,demand);
 const gain=(first,q)=>first.id==='early'&&q.id==='later'?1:q.score;
 assert.ok(dominant.score+reach(dominant,q=>gain(dominant,q)).adjustment>early.score+reach(early,q=>gain(early,q)).adjustment);
});
test('market labels track remaining order/next-turn distance, never invented survival probabilities',()=>{
 assert.equal(marketTiming(50,20,10,16).risk,'POSSIBLE');
 assert.equal(marketTiming(50,20,2,16).risk,'SAFE');
 assert.equal(marketTiming(50,5,10,56).risk,'RISKY');
 assert.equal(marketTiming(undefined,undefined,10,16).risk,'UNKNOWN');
 assert.equal(marketTiming(undefined,undefined,0,16).risk,'UNKNOWN');
 assert.match(marketTiming(5,1,10,16).reason,/not a survival probability/);
});
test('market-listed goalies/unprojected players consume demand; recorded goalie and unknown selections are removed',()=>{
 const s=snap([{...row(1,'Goalie',3),positions:['G']},row(2,'Unprojected',4),row(3,'Known',5)]);
 const ps=[{id:'known',name:'Known'}];
 assert.deepEqual(prepareMarketDemand(ps,[],s).ids,['yahoo-market:1','yahoo-market:2','known']);
 const p=[{playerId:'g',yahooPlayerId:'477.p.1',pickNumber:1},{playerId:'u',playerName:'Unprojected',pickNumber:2}];
 assert.deepEqual(prepareMarketDemand(ps,p,s).ids,['known']);
});
test('bounded market survivors are independent of VOR and input order; unknowns are not assumed future targets',()=>{
 const ps=Array.from({length:40},(_,i)=>({...option(String(i),40-i),positions:[['C','LW','RW','D'][i%4]]}));
 const ids=[...ps].reverse().map(p=>p.id);
 for(const p of ps){let n=0;const a=prepareDraftOpportunity(ps,10,()=>true,ids)(p,q=>{n++;assert.ok(!ids.slice(0,10).includes(q.id));return q.score;});assert.ok(n<=8);
 assert.deepEqual(a,prepareDraftOpportunity([...ps].reverse(),10,()=>true,ids)(p,q=>q.score));}
 assert.equal(prepareDraftOpportunity(ps,10,()=>true,[])(ps[0],()=>999).adjustment,0);
});
test('ADP never changes projections, PV, Team Fit, category contributions or replacement; only acquisition outputs',()=>{
 const m=replacementValues(players,10),s=snapshotFor(m.ranked),before=JSON.stringify(m);
 const ctx={...context(m.ranked),leagueTeams:10,myDraftSlot:5,fantasyTeams:Array.from({length:10},(_,i)=>({id:`team-${i+1}`,isMyTeam:i===4})),draftPicks:[{playerId:'unknown',pickNumber:4,fantasyTeamId:'team-4'}]};
 const changed={...s,players:s.players.map((p,i)=>({...p,adp:i===0?70:i===69?1:p.adp}))};
 const a=rankRecommendations(ctx,m,s),b=rankRecommendations(ctx,m,changed);
 for(const p of a){const q=b.find(x=>x.id===p.id);assert.deepEqual(p.decision.playerValue,q.decision.playerValue);assert.deepEqual(p.decision.teamFit,q.decision.teamFit);assert.deepEqual(p.fit,q.fit);assert.deepEqual(p.valueContributions,q.valueContributions);}
 assert.equal(JSON.stringify(m),before);assert.ok(a.some(p=>p.decision.draftUrgency.level!==b.find(q=>q.id===p.id).decision.draftUrgency.level));
 assert.ok(a.some(p=>p.score!==b.find(q=>q.id===p.id).score));
 for(const slot of [3,5]){const off=rankRecommendations({...ctx,myDraftSlot:slot,draftPicks:[]},m,s);for(const p of off){const q=a.find(q=>q.id===p.id);assert.equal(p.vor,q.vor);assert.equal(p.decision.teamFit.adjustment,q.decision.teamFit.adjustment);assert.equal(p.decision.draftUrgency.adjustment,0);}}
 const unknown=rankRecommendations(ctx,m,snap([]));assert.ok(unknown.every(p=>p.returnRisk==='UNKNOWN'&&p.decision.draftUrgency.adjustment===0));
});
