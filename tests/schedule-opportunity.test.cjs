const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./load.cjs');
const {prepareScheduleOpportunity}=load('src/lib/model/schedule.ts');
const {categories}=load('src/lib/model/config.ts');

const deviations=Object.fromEntries(categories.map(c=>[c,10]));
const stats=Object.fromEntries(categories.map(c=>[c,82]));
const player=(id,team,positions)=>({id,name:id,team,positions,age:25,gp:82,missingFields:[],...stats});
const allDates=Array.from({length:11},(_,i)=>`2027-03-${String(15+i).padStart(2,'0')}`);
function schedule(team,dates,seasonOffNightGames=30,playoffOffNightGames=0,regularSeasonOffNightDates){
 const weeks={
  '24':{games:dates.filter(d=>d<='2027-03-21').length,offNightGames:0},
  '25':{games:dates.filter(d=>d>='2027-03-22'&&d<='2027-03-28').length,offNightGames:0},
  '26':{games:dates.filter(d=>d>='2027-03-29').length,offNightGames:0},
 };
 return {team,seasonGames:82,seasonOffNightGames,regularSeasonOffNightDates,playoffGames:dates.length,playoffOffNightGames,playoffDates:dates,playoffByWeek:weeks};
}
function regularDates(count,start=0){
 const base=new Date('2026-10-01T12:00:00Z');
 return Array.from({length:count},(_,i)=>{
  const d=new Date(base);d.setUTCDate(d.getUTCDate()+start+i*2);return d.toISOString().slice(0,10);
 });
}

test('exact daily allocation gives multi-position eligibility value only when it opens a real lineup slot',()=>{
 const before=[
  player('c1','T1',['C']),player('c2','T2',['C']),
  player('lw1','T3',['LW']),player('lw2','T4',['LW']),
  player('rw1','T5',['RW']),player('rw2','T6',['RW']),
  player('d1','T7',['D']),player('d2','T8',['D']),player('d3','T9',['D']),player('d4','T10',['D']),
  player('replace','TB1',['C']),player('bench-lw','TB2',['LW']),player('bench-rw','TB3',['RW']),player('bench-d','TB4',['D']),
 ];
 const flex=player('flex','TB1',['C','LW']);
 const players=[...before,flex];
 const early=new Set(['T1','T2','T3','T7','T8','T9','T10','TB1']);
 const schedules=Object.fromEntries([...new Set(players.map(p=>p.team))].map(team=>[
  team,schedule(team,[early.has(team)?'2027-03-15':'2027-03-16'])
 ]));
 const evaluate=prepareScheduleOpportunity(players,schedules,deviations);
 const result=evaluate(flex,before.map(p=>p.id),before.map(p=>p.id==='replace'?'flex':p.id));
 assert.equal(result.exact,true);
 assert.equal(result.games,1);
 assert.equal(result.usableStarts,1);
 assert.equal(result.extraStarts,1);
 assert.ok(result.adjustment>0);
});

test('multi-position eligibility gets no flat bonus when daily access is unchanged',()=>{
 const before=[
  player('c1','T1',['C']),player('replace','T2',['C']),
  player('lw1','T3',['LW']),player('lw2','T4',['LW']),
  player('rw1','T5',['RW']),player('rw2','T6',['RW']),
  player('d1','T7',['D']),player('d2','T8',['D']),player('d3','T9',['D']),player('d4','T10',['D']),
  player('bench-c','B1',['C']),player('bench-lw','B2',['LW']),player('bench-rw','B3',['RW']),player('bench-d','B4',['D']),
 ];
 const flex=player('flex','T2',['C','LW','RW']);
 const players=[...before,flex];
 const schedules=Object.fromEntries([...new Set(players.map(p=>p.team))].map((team,i)=>[
  team,schedule(team,[i%2?'2027-03-15':'2027-03-16'])
 ]));
 const evaluate=prepareScheduleOpportunity(players,schedules,deviations);
 const result=evaluate(flex,before.map(p=>p.id),before.map(p=>p.id==='replace'?'flex':p.id));
 assert.equal(result.extraStarts,0);
 assert.ok(Math.abs(result.adjustment)<1e-10);
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


test('regular-season off-night access is valued separately from playoff dates',()=>{
 const dates=['2027-03-15'];
 const before=[
  player('replace','LOWOFF',['D']),player('d2','T2',['D']),player('d3','T3',['D']),player('d4','T4',['D']),
  player('c1','T5',['C']),player('c2','T6',['C']),
  player('lw1','T7',['LW']),player('lw2','T8',['LW']),
  player('rw1','T9',['RW']),player('rw2','T10',['RW']),
 ];
 const candidate=player('candidate','HIGHOFF',['D']);
 const players=[...before,candidate];
 const lowDates=regularDates(29),highDates=regularDates(40),averageDates=regularDates(30);
 const schedules={LOWOFF:schedule('LOWOFF',dates,29,0,lowDates),HIGHOFF:schedule('HIGHOFF',dates,40,0,highDates)};
 for(const p of before.slice(1))schedules[p.team]=schedule(p.team,dates,30,0,averageDates);
 const evaluate=prepareScheduleOpportunity(players,schedules,deviations);
 const result=evaluate(candidate,before.map(p=>p.id),before.map(p=>p.id==='replace'?'candidate':p.id));
 assert.equal(result.games,1);
 assert.equal(result.seasonOffNightGames,40);
 assert.equal(result.seasonExact,true);
 assert.equal(result.usableOffNightStarts,40);
 assert.ok(result.seasonOffNightAdjustment>0);
 assert.ok(Math.abs(result.playoffAdjustment)<1e-10);
 assert.ok(result.adjustment>0);
});

test('playoff off nights are excluded from regular-season off-night term to avoid double counting',()=>{
 const dates=['2027-03-15'];
 const before=[
  player('replace','A',['D']),player('d2','T2',['D']),player('d3','T3',['D']),player('d4','T4',['D']),
  player('c1','T5',['C']),player('c2','T6',['C']),
  player('lw1','T7',['LW']),player('lw2','T8',['LW']),
  player('rw1','T9',['RW']),player('rw2','T10',['RW']),
 ];
 const candidate=player('candidate','B',['D']);
 const players=[...before,candidate];
 const exact30=regularDates(30);
 const schedules={A:schedule('A',dates,30,0,exact30),B:schedule('B',dates,31,1,exact30)};
 for(const p of before.slice(1))schedules[p.team]=schedule(p.team,dates,30,0,exact30);
 const evaluate=prepareScheduleOpportunity(players,schedules,deviations);
 const result=evaluate(candidate,before.map(p=>p.id),before.map(p=>p.id==='replace'?'candidate':p.id));
 assert.ok(Math.abs(result.seasonOffNightAdjustment)<1e-10);
});


test('aggregate off-night counts alone do not create a regular-season bonus',()=>{
 const dates=['2027-03-15'];
 const before=[
  player('replace','LOW',['D']),player('d2','T2',['D']),player('d3','T3',['D']),player('d4','T4',['D']),
  player('c1','T5',['C']),player('c2','T6',['C']),
  player('lw1','T7',['LW']),player('lw2','T8',['LW']),
  player('rw1','T9',['RW']),player('rw2','T10',['RW']),
 ];
 const candidate=player('candidate','HIGH',['D']);
 const players=[...before,candidate];
 const schedules={LOW:schedule('LOW',dates,29),HIGH:schedule('HIGH',dates,40)};
 for(const p of before.slice(1))schedules[p.team]=schedule(p.team,dates,30);
 const evaluate=prepareScheduleOpportunity(players,schedules,deviations);
 const result=evaluate(candidate,before.map(p=>p.id),before.map(p=>p.id==='replace'?'candidate':p.id));
 assert.equal(result.seasonExact,false);
 assert.equal(result.seasonOffNightAdjustment,0);
});
