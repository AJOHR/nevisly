const {load}=require('./load.cjs'),{test}=require('node:test'),assert=require('node:assert/strict');
const {prepareCategoryFit,canonicalSelections}=load('src/lib/model/categoryFit.ts');
const {replacementValues}=load('src/lib/model/replacement.ts');const {players,teams}=require('./model-scenarios.cjs');
const market=replacementValues(players,12);
function fit(picks=[]){return prepareCategoryFit({players:market.ranked,reserves:market.reserves,market:market.allocated,deviations:market.deviations,selections:canonicalSelections(picks),teams});}
test('empty and uneven rosters produce finite, decomposable incremental values',()=>{
 for(const n of [0,3,12]){const picks=players.slice(20,20+n).map((p,i)=>({playerId:p.id,pickNumber:i+1,fantasyTeamId:i%3?'team-1':'team-2'}));
 const evaluate=fit(picks);for(const p of market.ranked){const a=evaluate(p);assert.ok(Number.isFinite(a.adjustment));assert.ok(Math.abs(a.adjustment-(a.rosterGain-p.vor+a.saturationAdjustment))<1e-9);}}
});
test('filled positions cannot credit a player who does not improve the projected starting roster',()=>{
 const picks=players.filter(p=>p.positions.includes('C')).slice(0,8).map((p,i)=>({playerId:p.id,pickNumber:i+1,fantasyTeamId:'team-1'}));
 const weak=market.ranked.filter(p=>p.positions.length===1&&p.positions[0]==='C').at(-1);
 const a=fit(picks)(weak);assert.equal(a.rosterGain,0);assert.equal(a.starterImprovement,false);
});
test('goalie and unknown selections remain canonical slots, with explicit uncertainty',()=>{
 const picks=[{playerId:'unknown',fantasyTeamId:'team-1',pickNumber:1},{playerId:'goalie',positions:['G'],fantasyTeamId:'team-1',pickNumber:2}];
 const s=canonicalSelections(picks);assert.deepEqual(s.map(x=>x.ordinal),[1,2]);
 const a=fit(picks)(market.ranked[0]);assert.ok(a.warnings.some(w=>w.includes('1 selection')));assert.ok(a.warnings.some(w=>w.includes('goalie')));
});
test('equivalent canonical input ignores adapter-specific identity and transport metadata',()=>{
 const picks=players.slice(20,25).map((p,i)=>({playerId:p.id,projectionId:p.id,selectionId:`s${i}`,pickNumber:i+1,fantasyTeamId:'team-1'}));
 const manual=picks.map(p=>({...p,source:'manual'})),bridge=picks.map(p=>({...p,source:'yahoo',yahooPlayerId:'12345',ownershipSource:'yahoo'}));
 assert.deepEqual(canonicalSelections(manual),canonicalSelections(bridge));assert.deepEqual(fit(manual)(market.ranked[0]),fit(bridge)(market.ranked[0]));
});
test('category fit is invariant to input selection order and never exposes a win probability',()=>{
 const picks=players.slice(20,28).map((p,i)=>({playerId:p.id,pickNumber:i+1,fantasyTeamId:'team-1'}));
 const a=fit(picks)(market.ranked[0]);assert.deepEqual(a,fit([...picks].reverse())(market.ranked[0]));assert.equal('probability' in a,false);
});

test('a lower-raw specialist can improve a close category through a feasible exchange',()=>{
 const {modelConfig}=load('src/lib/model/config.ts');
 const make=(id,goals,hits,rawScore)=>({id,name:id,positions:['C'],goals,hits,assists:0,points:0,ppp:0,sog:0,blocks:0,rawScore,vor:rawScore,zScores:{}});
 const own=make('owned',100,0,10),reserve=make('reserve',0,0,0),candidate=make('specialist',90,10,9);
 const evaluate=prepareCategoryFit({players:[own,reserve,candidate],reserves:[reserve],deviations:{goals:10,hits:10,assists:10,points:10,ppp:10,sog:10,blocks:10},market:new Map([['C1',reserve]]),selections:[{id:'pick1',projectionId:'owned',teamId:'me',ordinal:1,positions:['C']}],teams:[{id:'me',isMyTeam:true}],config:{...modelConfig,starters:{C:1},ownPriorSlots:0,categoryWidth:1}});
 const result=evaluate(candidate);
 assert.ok(result.starterImprovement);
 assert.deepEqual(result.replacementNames,['owned']);
 assert.ok(result.rosterGain+result.saturationAdjustment>0);
 assert.equal(result.categories.goals.productionGain,-1);
 assert.equal(result.categories.hits.productionGain,1);
});
