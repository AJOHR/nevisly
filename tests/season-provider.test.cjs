const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./load.cjs');
const {composeSeasonState}=load('src/lib/season/provider.ts');
const {manualSeasonFixture}=load('src/lib/season/fixture.ts');
function inputs(){const {swingUnits,...snapshot}=structuredClone(manualSeasonFixture);return {snapshot,config:{swingUnits}};}

test('partial provider data reports missing inputs without fabricating state',()=>{
 const {snapshot,config}=inputs();delete snapshot.week;delete snapshot.opponent;delete snapshot.freeAgents;
 const result=composeSeasonState(snapshot,config);
 assert.equal(result.available,false);assert.deepEqual(result.missing,['week','freeAgents','opponent']);
 assert.equal(result.state,undefined);assert.equal(snapshot.week,undefined);
});
test('swing units must come from Nevisly configuration, never provider fields',()=>{
 const {snapshot,config}=inputs();snapshot.swingUnits=config.swingUnits;
 assert.equal(composeSeasonState(snapshot,{}).available,false);
 snapshot.swingUnits={G:999};const result=composeSeasonState(snapshot,config);
 assert.equal(result.available,true);assert.deepEqual(result.state.swingUnits,config.swingUnits);
});
test('composition preserves unknown vs empty and zero; copies normalized complete input',()=>{
 const {snapshot,config}=inputs();snapshot.myTeam.current={G:0};snapshot.myTeam.remaining={};snapshot.freeAgents=[];
 delete snapshot.weekDates;delete snapshot.myTeam.roster[0].gameDates;
 delete snapshot.myTeam.roster[0].perGame;delete snapshot.myTeam.roster[0].rosValue;
 const result=composeSeasonState(snapshot,config);assert.equal(result.available,true);
 assert.equal(result.state.myTeam.current.G,0);assert.equal(result.state.myTeam.current.A,undefined);
 assert.equal(result.state.myTeam.remaining.G,undefined);assert.equal(result.state.weekDates,undefined);
 assert.equal(result.state.myTeam.roster[0].gameDates,undefined);assert.equal(result.state.myTeam.roster[0].perGame.G,undefined);
 assert.equal(result.state.myTeam.roster[0].rosValue,undefined);assert.deepEqual(result.state.freeAgents,[]);
 result.state.myTeam.roster[0].name='Changed';assert.notEqual(snapshot.myTeam.roster[0].name,'Changed');
 delete snapshot.myTeam.roster;assert.equal(composeSeasonState(snapshot,config).available,false);
});
test('invalid inputs fail composition rather than entering the engine',()=>{
 const {snapshot,config}=inputs();snapshot.week=0;
 assert.equal(composeSeasonState(snapshot,config).available,false);
 snapshot.week=1;config.swingUnits.G=0;
 assert.equal(composeSeasonState(snapshot,config).available,false);
});
