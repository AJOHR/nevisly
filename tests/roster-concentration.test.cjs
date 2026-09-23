const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./load.cjs');
const {rosterConcentrationAdjustment}=load('src/lib/model/rosterConcentration.ts');

const starters={C:2,LW:2,RW:2,D:4};
const p=(team,positions)=>({team,positions});

test('first two players from an NHL team are free, third and later are progressively penalized',()=>{
 const two=[p('NYR',['C']),p('NYR',['D'])];
 const third=rosterConcentrationAdjustment(p('NYR',['RW']),two,starters);
 assert.equal(third.resultingTeamCount,3);
 assert.equal(third.teamPenalty,0.25);
 const fourth=rosterConcentrationAdjustment(p('NYR',['RW']),[...two,p('NYR',['LW'])],starters);
 assert.equal(fourth.resultingTeamCount,4);
 assert.ok(fourth.teamPenalty>third.teamPenalty);
 assert.ok(fourth.teamPenalty<1);
});

test('team aliases count as the same NHL club',()=>{
 const result=rosterConcentrationAdjustment(p('TBL',['RW']),[p('TB',['G']),p('TBL',['C'])],starters);
 assert.equal(result.resultingTeamCount,3);
 assert.equal(result.teamPenalty,0.25);
});

test('pure C congestion starts only beyond the two C starter slots and rises progressively',()=>{
 const two=[p('EDM',['C']),p('BOS',['C'])];
 const third=rosterConcentrationAdjustment(p('COL',['C']),two,starters);
 assert.equal(third.resultingPurePositionCount,3);
 assert.equal(third.positionPenalty,0.2);
 const fourth=rosterConcentrationAdjustment(p('COL',['C']),[...two,p('TOR',['C'])],starters);
 assert.equal(fourth.resultingPurePositionCount,4);
 assert.ok(fourth.positionPenalty>third.positionPenalty);
});

test('multi-position skaters do not get the explicit pure-position congestion penalty',()=>{
 const owned=[p('EDM',['C']),p('BOS',['C']),p('TOR',['C']),p('NYR',['C'])];
 const flexible=rosterConcentrationAdjustment(p('COL',['C','LW']),owned,starters);
 assert.equal(flexible.purePosition,null);
 assert.equal(flexible.positionPenalty,0);
});

test('pure D congestion respects four D starter slots',()=>{
 const owned=['COL','EDM','BOS','NYR'].map(team=>p(team,['D']));
 const fifth=rosterConcentrationAdjustment(p('TBL',['D']),owned,starters);
 assert.equal(fifth.resultingPurePositionCount,5);
 assert.equal(fifth.positionPenalty,0.2);
});

test('combined adjustment is the negative sum of team and position penalties',()=>{
 const owned=[p('NYR',['C']),p('NYR',['D']),p('NYR',['C'])];
 const result=rosterConcentrationAdjustment(p('NYR',['C']),owned,starters);
 assert.ok(result.teamPenalty>0);
 assert.ok(result.positionPenalty>0);
 assert.ok(Math.abs(result.adjustment+result.teamPenalty+result.positionPenalty)<1e-12);
});


test('Yahoo ADP under 50 waives both concentration penalties',()=>{
 const owned=[p('NYR',['C']),p('NYR',['D']),p('NYR',['C'])];
 const result=rosterConcentrationAdjustment(p('NYR',['C']),owned,starters,49.9);
 assert.equal(result.adpPenaltyMultiplier,0);
 assert.ok(result.teamPenalty>0);
 assert.ok(result.positionPenalty>0);
 assert.equal(result.adjustment,0);
});

test('Yahoo ADP 50 through 79.9 applies half of concentration penalties',()=>{
 const owned=[p('NYR',['C']),p('NYR',['D']),p('NYR',['C'])];
 for(const adp of [50,60,79.9]){
  const result=rosterConcentrationAdjustment(p('NYR',['C']),owned,starters,adp);
  assert.equal(result.adpPenaltyMultiplier,0.5);
  const full=result.teamPenalty+result.positionPenalty;
  assert.ok(Math.abs(result.adjustment+full*0.5)<1e-12);
 }
});

test('Yahoo ADP 80 or later and unknown ADP apply full concentration penalties',()=>{
 const owned=[p('NYR',['C']),p('NYR',['D']),p('NYR',['C'])];
 for(const adp of [80,100,undefined]){
  const result=rosterConcentrationAdjustment(p('NYR',['C']),owned,starters,adp);
  assert.equal(result.adpPenaltyMultiplier,1);
  const full=result.teamPenalty+result.positionPenalty;
  assert.ok(Math.abs(result.adjustment+full)<1e-12);
 }
});
