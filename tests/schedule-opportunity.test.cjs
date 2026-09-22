const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./load.cjs');
const {prepareScheduleOpportunity}=load('src/lib/model/schedule.ts');
const {categories}=load('src/lib/model/config.ts');

const deviations=Object.fromEntries(categories.map(c=>[c,10]));
const stats=Object.fromEntries(categories.map(c=>[c,82]));
const player=(id,team,positions)=>({id,name:id,team,positions,age:25,gp:82,missingFields:[],...stats});
const allDates=Array.from({length:11},(_,i)=>`2027-03-${String(15+i).padStart(2,'0')}`);
function schedule(team,dates){
 const weeks={
  '24':{games:dates.filter(d=>d<='2027-03-21').length,offNightGames:0},
  '25':{games:dates.filter(d=>d>='2027-03-22'&&d<='2027-03-28').length,offNightGames:0},
  '26':{games:dates.filter(d=>d>='2027-03-29').length,offNightGames:0},
 };
 return {team,seasonGames:82,seasonOffNightGames:0,playoffGames:dates.length,playoffOffNightGames:0,playoffDates:dates,playoffByWeek:weeks};
}

test('exact daily allocation gives multi-position eligibility value only when it opens a real lineup slot',()=>{
 const before=[
  player('c1','T1',['C']),player('c2','T2',['C']),player('replace','T3',['C']),
  player('lw1','T4',['LW']),player('rw1','T5',['RW']),player('rw2','T6',['RW']),
  player('d1','T7',['D']),player('d2','T8',['D']),player('d3','T9',['D']),player('d4','T10',['D']),
 ];
 const flex=player('flex','T3',['C','LW']);
 const players=[...before,flex];
 const schedules=Object.fromEntries(players.map(p=>[p.team,schedule(p.team,['2027-03-15'])]));
 const evaluate=prepareScheduleOpportunity(players,schedules,deviations);
 const result=evaluate(flex,before.map(p=>p.id),before.map(p=>p.id==='replace'?'flex':p.id));
 assert.equal(result.exact,true);
 assert.equal(result.games,1);
 assert.equal(result.usableStarts,1);
 assert.equal(result.extraStarts,1);
 assert.ok(result.adjustment>0);
});

test('same-production nine-game player is penalized against an eleven-game feasible starter',()=>{
 const eleven=allDates, nine=allDates.slice(0,9);
 const before=[
  player('replace','ELEVEN',['C']),player('c2','T2',['C']),
  player('lw1','T3',['LW']),player('lw2','T4',['LW']),
  player('rw1','T5',['RW']),player('rw2','T6',['RW']),
  player('d1','T7',['D']),player('d2','T8',['D']),player('d3','T9',['D']),player('d4','T10',['D']),
 ];
 const candidate=player('candidate','NINE',['C']);
 const players=[...before,candidate];
 const schedules={ELEVEN:schedule('ELEVEN',eleven),NINE:schedule('NINE',nine)};
 for(const p of before.slice(1))schedules[p.team]=schedule(p.team,eleven);
 const evaluate=prepareScheduleOpportunity(players,schedules,deviations);
 const result=evaluate(candidate,before.map(p=>p.id),before.map(p=>p.id==='replace'?'candidate':p.id));
 assert.equal(result.exact,true);
 assert.equal(result.games,9);
 assert.equal(result.usableStarts,9);
 assert.equal(result.extraStarts,-2);
 assert.ok(result.adjustment<0);
});
