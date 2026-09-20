const {load}=require('./load.cjs'),{test}=require('node:test'),assert=require('node:assert/strict');
const {normalizeProjections,replacementValues}=load('src/lib/model/replacement.ts');
const {rankRecommendations,availableRecommendationRanks}=load('src/lib/model/engine.ts');
const {prepareCategoryFit}=load('src/lib/model/categoryFit.ts');
const {prepareScheduleOpportunity}=load('src/lib/model/schedule.ts');
const {modelConfig,categories}=load('src/lib/model/config.ts');
const {players,context}=require('./model-scenarios.cjs');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const schedule=(games,off=4)=>({team:'X',seasonGames:82,seasonOffNightGames:40,playoffGames:games,playoffOffNightGames:off,
 playoffByWeek:{24:{games:Math.floor(games/3),offNightGames:1},25:{games:Math.floor(games/3),offNightGames:1},26:{games:games-2*Math.floor(games/3),offNightGames:off-2}}});

test('normalization samples roster roles, not just high-point forwards, without amplifying BLK on a tiny forward scale',()=>{
 const pool=Array.from({length:400},(_,i)=>({...players[0],id:`r${String(i).padStart(3,'0')}`,positions:[i<300?['C','LW','RW'][i%3]:'D'],points:i<300?100:10,blocks:i<300?i%2:100+i%2}));
 const normalized=normalizeProjections(pool);
 assert.ok(normalized.deviations.blocks>40);
 assert.ok(normalized.ranked.every(p=>Math.abs(p.zScores.blocks)<2));
 // Moving all defense above the point cutoff must not change the role mix or BLK scale.
 const flipped=normalizeProjections(pool.map(p=>({...p,points:p.positions[0]==='D'?1000:p.points})));
 near(normalized.deviations.blocks,flipped.deviations.blocks);
});

const candidate={...players[0],id:'candidate',team:'A',positions:['C']};
const peer={...candidate,id:'peer',team:'B'};
const deviations=Object.fromEntries(categories.map(c=>[c,20]));
test('playoff opportunity is incremental projected production, includes only Weeks 24–26 and ignores flat seasonal bonuses',()=>{
 const a=schedule(11),b=schedule(9),evaluate=prepareScheduleOpportunity([candidate,peer],[],{A:a,B:b},deviations);
 const result=evaluate(candidate);
 near(result.extraStarts,2);
 near(result.adjustment,2*categories.reduce((n,c)=>n+candidate[c]/20,0)/82);
 const changed={...a,playoffGames:99,seasonOffNightGames:99,playoffByWeek:{...a.playoffByWeek,27:{games:8,offNightGames:8}}};
 near(prepareScheduleOpportunity([candidate,peer],[],{A:changed,B:b},deviations)(candidate).adjustment,result.adjustment);
});
test('missing or partial schedule is neutral, including absent alternatives',()=>{
 for(const schedules of [{},{A:schedule(11)},{A:{...schedule(11),playoffByWeek:{}},B:schedule(9)}])
  assert.equal(prepareScheduleOpportunity([candidate,peer],[],schedules,deviations)(candidate).adjustment,0);
});
test('off-night distribution matters only when actual eligible roster capacity is congested',()=>{
 const schedules={A:schedule(10,6),B:schedule(10,3)};
 near(prepareScheduleOpportunity([candidate,peer],[],schedules,deviations)(candidate).adjustment,0);
 const own=[{...candidate,id:'own1'},{...candidate,id:'own2'}];
 const busy=prepareScheduleOpportunity([candidate,peer],own,schedules,deviations)(candidate);
 assert.ok(busy.adjustment>0);near(busy.extraStarts,1); // 2 starting C / 3 C; off nights remain usable.
});

const ps=[...players,{...players[0],id:'close-a',team:'A'},{...players[0],id:'close-b',team:'B'},
 {...players[0],id:'superior',team:'B',...Object.fromEntries(categories.map(c=>[c,players[0][c]*1.5]))}];
const market=replacementValues(ps,12),ctx=context(market.ranked,0);
const base=rankRecommendations(ctx,market);
const scheduled=rankRecommendations({...ctx,playoffSchedule:{EDM:schedule(10),A:schedule(11),B:schedule(9)}},market);
test('schedule breaks a close decision but two games do not overcome a substantial production gap',()=>{
 const find=(out,id)=>out.find(p=>p.id===id);
 near(find(base,'close-a').score,find(base,'close-b').score);
 assert.ok(find(scheduled,'close-a').score>find(scheduled,'close-b').score);
 assert.ok(find(scheduled,'superior').score>find(scheduled,'close-a').score);
 for(const p of scheduled){
  near(p.decision.playerValue.score,find(base,p.id).decision.playerValue.score);
  near(p.decision.teamFit.adjustment-find(base,p.id).decision.teamFit.adjustment,p.contributions.schedule);
 }
 assert.ok(find(scheduled,'close-a').explanations.some(r=>r.includes('Weeks 24–26')));
 assert.ok(!base.some(p=>p.explanations.some(r=>r.includes('Weeks 24–26'))));
});
test('replacement and positional economics enter recommendation score once, not as stacked VOR and fit rewards',()=>{
 for(const p of base){
  near(p.decision.playerValue.score,p.vor);
  near(p.score-p.decision.draftUrgency.adjustment,p.fit.starterImprovement?p.fit.rosterGain+p.fit.saturationAdjustment:p.vor);
  near(p.contributions.rosterOpportunity,p.fit.starterImprovement?p.fit.rosterGain-p.vor:0);
 }
 const changed={...market,ranked:market.ranked.map(p=>({...p,vor:p.vor+100}))};
 const recalculated=rankRecommendations({...ctx,rankedPlayers:ctx.rankedPlayers.map(p=>({...p,vor:p.vor+100}))},changed);
 for(const p of base.filter(p=>p.fit.starterImprovement))near(p.score,recalculated.find(q=>q.id===p.id).score);
});

function flexFit(positions,ownPosition='C'){
 const make=(id,pos,value)=>({...candidate,id,name:id,positions:pos,rawScore:value,vor:value,zScores:{},...Object.fromEntries(categories.map(c=>[c,value]))});
 const own=make('own',[ownPosition],10),c=make('reserve-c',['C'],1),lw=make('reserve-lw',['LW'],1),p=make('choice',positions,9);
 const evaluate=prepareCategoryFit({players:[own,c,lw,p],reserves:[c,lw],deviations:Object.fromEntries(categories.map(c=>[c,1])),market:new Map([['C1',c],['LW1',lw]]),selections:[{id:'s1',projectionId:'own',teamId:'me',ordinal:1,positions:own.positions}],teams:[{id:'me',isMyTeam:true}],config:{...modelConfig,starters:{C:1,LW:1},fitWeight:0}});
 return evaluate(p);
}
test('multi-position value comes from preserving strong starters, not counting eligibility labels',()=>{
 assert.equal(flexFit(['C']).rosterGain,0);
 assert.ok(flexFit(['C','LW']).rosterGain>0);
 near(flexFit(['LW']).rosterGain,flexFit(['C','LW']).rosterGain);
 near(flexFit(['LW','C']).rosterGain,flexFit(['LW','C','RW']).rosterGain);
});
test('elite forward beats a modest defender, while genuinely elite defense remains valuable',()=>{
 const out=base,rank=id=>out.findIndex(p=>p.id===id);
 assert.ok(rank('p000')<rank('p163'));
 assert.ok(rank('p003')<rank('p160'));
});
test('overall ranks reuse canonical order, remain unchanged by filters/search, and exclude drafted players',()=>{
 const ranks=availableRecommendationRanks(base,new Set());
 for(const [i,p] of base.entries())assert.equal(ranks.get(p.id),i+1);
 for(const p of base.filter(p=>p.positions.includes('D')))assert.equal(ranks.get(p.id),base.indexOf(p)+1);
 const found=base.find(p=>p.name.includes('Premium'));assert.equal(ranks.get(found.id),base.indexOf(found)+1);
 const next=availableRecommendationRanks(base,new Set([base[0].id]));assert.equal(next.has(base[0].id),false);assert.equal(next.get(base[1].id),1);
 const fs=require('fs'),source=fs.readFileSync('src/components/ProjectionUpload.tsx','utf8');
 assert.match(source,/availableRecommendationRanks\(finalRankedPlayers, draftedIds\)/);
 assert.match(source,/overallRecommendationRanks\.get\(player.id\)/);
 assert.ok(source.indexOf('const overallRecommendationRanks')<source.indexOf('const filteredPlayers'));
});
