const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./load.cjs');
const {prepareDraftOpportunity}=load('src/lib/model/draftOpportunity.ts');
const {prepareCategoryFit}=load('src/lib/model/categoryFit.ts');
const {modelConfig,categories}=load('src/lib/model/config.ts');
const {rankRecommendations,availableRecommendationRanks}=load('src/lib/model/engine.ts');
const {replacementValues}=load('src/lib/model/replacement.ts');
const {getNextTurn}=load('src/lib/draft/state.ts');
const {players,context}=require('./model-scenarios.cjs');
const option=(id,position,score)=>({id,positions:[position],score,vor:score});
const options=[option('defender','D',12),option('forward','LW',11),
 ...Array.from({length:20},(_,i)=>option(`depth-${i}`,'D',9.5-i*.01)),option('late-forward','LW',2)];
// Two strong D already owned, two D starting slots still open: a second D is
// feasible, not banned. Marginal value of an additional same-role player is
// reduced only by the next realistic starter it replaces.
function board(pool,wait){
 const plan=prepareDraftOpportunity(pool,wait);
 // The best open D upgrade has already been used by a D first pick. The
 // remaining D starter is nine units stronger, so the second gain is smaller.
 return pool.map(p=>({...p,total:p.score+plan(p,q=>p.positions[0]==='D'&&q.positions[0]==='D'?Math.max(0,q.score-9):q.score).adjustment})).sort((a,b)=>b.total-a.total||b.score-a.score);
}
test('cross-position next-pick tradeoff can outweigh stronger immediate replacement value',()=>{
 const out=board(options,1);
 assert.equal(out[0].id,'forward');
 assert.ok(options[0].score>options[1].score);
});
test('no two-D limit: a premium D still wins when his advantage exceeds remaining alternatives',()=>{
 const out=board(options.map(p=>p.id==='defender'?{...p,score:30,vor:30}:p),1);
 assert.equal(out[0].id,'defender');
});
test('longer wait exhausts the comparable D tier and changes the preferred current pick',()=>{
 assert.equal(board(options,1)[0].id,'forward');
 assert.equal(board(options,22)[0].id,'defender');
 const zero=prepareDraftOpportunity(options,0);
 assert.equal(zero(options[0],()=>99).adjustment,0);
});
test('current selection is excluded from both opponent removal and the next-pick plan; work is bounded',()=>{
 for(const p of options){
  let calls=0;
  prepareDraftOpportunity(options,1)(p,q=>{calls++;assert.notEqual(q.id,p.id);return q.score;});
  assert.ok(calls<=8);
 }
 const p=options[0],a=prepareDraftOpportunity(options,1)(p,q=>q.score);
 assert.deepEqual(a,prepareDraftOpportunity([...options].reverse(),1)(p,q=>q.score));
});
test('second selection uses actual feasible allocation, preserves first pick, and does not count it twice',()=>{
 const make=(id,positions,value)=>({...players[0],id,name:id,positions,vor:value,rawScore:value,zScores:{},...Object.fromEntries(categories.map(c=>[c,value]))});
 const own=[make('owned-d1',['D'],20),make('owned-d2',['D'],20)];
 const reserves=Object.entries(modelConfig.starters).flatMap(([p,n])=>Array.from({length:n},(_,i)=>make(`r-${p}-${i}`,[p],1)));
 const first=make('first',['D'],12),second=make('second',['D'],11),forward=make('forward',['LW'],11);
 const all=[...own,...reserves,first,second,forward];
 const evaluate=prepareCategoryFit({players:all,reserves,deviations:Object.fromEntries(categories.map(c=>[c,1])),
  market:new Map(reserves.map(p=>[p.id,p])),selections:own.map((p,i)=>({id:`s${i}`,projectionId:p.id,teamId:'me',ordinal:i+1,positions:p.positions})),
  teams:[{id:'me',isMyTeam:true}],config:{...modelConfig,fitWeight:0}});
 evaluate(first);const b=evaluate.afterSelection(second,first.id),f=evaluate.afterSelection(forward,first.id);
 assert.ok(b.starterImprovement);assert.ok(f.starterImprovement);
 assert.equal(b.rosterGain,70); // 7 categories × (11 − 1), not the first D's gain again.
 assert.ok(!b.replacementNames.includes(first.name));
 const flex=make('flex',['D','LW'],11);
 assert.equal(evaluate.afterSelection(flex,first.id).rosterGain,f.rosterGain);
 assert.equal(evaluate.afterSelection(first,first.id).rosterGain,0);
 assert.equal(evaluate.afterSelection(first,first.id).starterImprovement,false);
});
test('engine after two owned D prefers the forward opportunity, but retains genuinely dominant D',()=>{
 const make=(id,pos,value)=>({...players[0],id,name:id,positions:[pos],vor:7*(value-1),rawScore:7*value,replacementAvailable:true,zScores:{},...Object.fromEntries(categories.map(c=>[c,value]))});
 function run(defenderValue){
  const own=[make('own-a','D',40),make('own-b','D',40)];
  const reserves=Object.entries(modelConfig.starters).flatMap(([p,n])=>Array.from({length:n},(_,i)=>make(`r${p}${i}`,p,p==='D'&&i===0?9:1)));
  const ranked=[...own,...reserves,make('choice-d','D',defenderValue),make('choice-f','LW',12),make('late-f','LW',2),
   ...Array.from({length:20},(_,i)=>make(`later-d${i}`,'D',11-i*.01))];
  const market={ranked,reserves,allocated:new Map(reserves.map(p=>[`${p.positions[0]}${p.id.slice(-1)}`,p])),deviations:Object.fromEntries(categories.map(c=>[c,1]))};
  const ctx={...context(ranked),leagueTeams:8,myDraftSlot:8,fantasyTeams:Array.from({length:8},(_,i)=>({id:`team-${i+1}`,isMyTeam:i===7})),
   draftPicks:[{playerId:'own-a',pickNumber:8,fantasyTeamId:'team-8'},{playerId:'own-b',pickNumber:9,fantasyTeamId:'team-8'},
    {playerId:'unprojected',pickNumber:22,fantasyTeamId:'team-6'}]};
  const output=rankRecommendations(ctx,market).filter(p=>!own.some(o=>o.id===p.id));
  return output;
 }
 const close=run(13),dominant=run(30);
 assert.equal(close[0].id,'choice-f');assert.equal(dominant[0].id,'choice-d');
 assert.ok(close.find(p=>p.id==='choice-d').decision.playerValue.score>close[0].decision.playerValue.score);
});
test('snake wait uses real ordinals including unknowns/goalies; final turn disables future planning',()=>{
 const picks=[{playerId:'unknown',pickNumber:7,fantasyTeamId:'team-7',positions:['G']}];
 assert.equal(getNextTurn(picks,8,8).opponentTeamIds.length,0);
 assert.equal(getNextTurn([{...picks[0],pickNumber:8}],8,8).opponentTeamIds.length,14);
 const m=replacementValues(players,8),ctx={...context(m.ranked),leagueTeams:8,myDraftSlot:1,
  draftPicks:[{...picks[0],pickNumber:127}],fantasyTeams:context(m.ranked).fantasyTeams.slice(0,8)};
 assert.ok(rankRecommendations(ctx,m).every(p=>p.decision.draftUrgency.adjustment===0));
});
test('8/12-team economics and timing leave Player Value/Team Fit intact; ranks follow final ordering',()=>{
 const views=[];
 for(const size of [8,12]){
  const market=replacementValues(players,size),ctx={...context(market.ranked),leagueTeams:size};
  const a=rankRecommendations({...ctx,myDraftSlot:1},market),b=rankRecommendations({...ctx,myDraftSlot:size},market);
  for(const p of a){const q=b.find(q=>q.id===p.id);assert.equal(p.decision.playerValue.score,q.decision.playerValue.score);assert.equal(p.decision.teamFit.adjustment,q.decision.teamFit.adjustment);}
  const ranks=availableRecommendationRanks(a,new Set());
  for(const p of a.filter(p=>p.positions.includes('D')&&p.name.includes('Fixture')))assert.equal(ranks.get(p.id),a.indexOf(p)+1);
  assert.equal(availableRecommendationRanks(a,new Set([a[0].id])).get(a[1].id),1);
  views.push(a.map(p=>[p.id,p.decision.draftUrgency.adjustment]));
 }
 assert.notDeepEqual(views[0],views[1]);
});
