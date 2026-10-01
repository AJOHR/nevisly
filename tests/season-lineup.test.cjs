const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./load.cjs');
const {SKATER_CATEGORIES,normalizeSeasonState}=load('src/lib/season/state.ts');
const {manualSeasonFixture:fixture}=load('src/lib/season/fixture.ts');
const {allocateWeek}=load('src/lib/season/lineup.ts');
const {compareMove,weeklyCategoryImpact,seasonMoves}=load('src/lib/season/engine.ts');
const dates=['2026-10-06','2026-10-08','2026-10-10','2026-10-11'];
const stats=n=>Object.fromEntries(SKATER_CATEGORIES.map(c=>[c,n]));
const player=(id,positions,gameDates,rate=1)=>({id,name:id,team:'TEST',kind:'skater',positions,gameDates,rosValue:1,perGame:stats(rate)});
function state(roster,freeAgents=[],slots={C:1,LW:1}){
 const s=structuredClone(fixture);s.myTeam.roster=roster;s.freeAgents=freeAgents;s.rosterSlots=slots;
 s.myTeam.current=stats(0);s.opponent.current=stats(0);s.opponent.remaining=stats(4);s.swingUnits={...s.swingUnits,...stats(10)};
 return s;
}
test('four scheduled games become two starts under congestion; fixture mirrors that case',()=>{
 const p=player('z',['C'],dates),strong=player('a',['C'],dates.slice(0,2),2);
 const result=allocateWeek(state([p,strong],[],{C:1}));
 assert.equal(result.players.z.scheduled,4);assert.equal(result.players.z.usable,2);assert.equal(result.benched,2);
 assert.deepEqual(result.days[0].benchedIds,['z']);
 const actual=allocateWeek(fixture);assert.equal(actual.scheduled,54);assert.equal(actual.usable,40);assert.equal(actual.benched,14);
 assert.equal(actual.players['manual-14'].scheduled,4);assert.equal(actual.players['manual-14'].usable,2);
});
test('multi-position matching recovers a start without UTIL or duplicate use',()=>{
 const a=player('a',['C'],[dates[0]],2),b=player('b',['C'],[dates[0]]);
 const s=state([a,b]);assert.equal(allocateWeek(s).usable,1);
 a.positions.push('LW');const r=allocateWeek(s);assert.equal(r.usable,2);
 assert.equal(new Set(r.days[0].assignments.map(a=>a.playerId)).size,2);
 assert.ok(r.days[0].assignments.every(a=>a.slot==='C1'||a.slot==='LW1'));
});
test('off-night same-quality candidate adds more whole-roster starts and weekly fit',()=>{
 const core=player('core',['C'],dates,2),bench=player('bench',['C'],dates,.5);
 const off=player('off',['C'],['2026-10-05','2026-10-07']),busy=player('busy',['C'],dates.slice(0,2));
 const s=state([core,bench],[off,busy],{C:1});
 const a=compareMove(s,off,bench),b=compareMove(s,busy,bench);
 assert.equal(a.gamesChange,2);assert.equal(b.gamesChange,0);assert.ok(a.weeklyFit>b.weeklyFit);
 assert.equal(a.after.players.off.usable,2);assert.equal(b.after.players.busy.usable,0);
});
test('removing a starter recovers another player’s bench game; all production is recomputed',()=>{
 const core=player('core',['C'],[dates[0]],1),bench=player('bench',['C'],[dates[0]],.5),add=player('add',['LW'],['2026-10-07'],1);
 const s=state([core,bench],[add]);const m=compareMove(s,add,core);
 assert.equal(m.before.usable,1);assert.equal(m.after.usable,2);assert.equal(m.gamesChange,1);
 assert.equal(m.after.players.bench.usable,1);assert.equal(m.delta.G,.5);
 assert.equal(m.rosChange,0);
});
test('gap utility is bounded and prioritizes Close/Swing over extra Strong production',()=>{
 assert.equal(weeklyCategoryImpact(2,100,1),0);
 assert.ok(weeklyCategoryImpact(-1.5,1,1)>0);assert.ok(weeklyCategoryImpact(0,1,1)>0);
 assert.equal(weeklyCategoryImpact(0,1000,1),1);
 assert.equal(weeklyCategoryImpact(2,-2,1),-1);
});
test('ROS never controls starts or changes with schedule',()=>{
 const s=state([player('a',['C'],dates,2),player('b',['C'],dates)], [player('off',['C'],['2026-10-05'])],{C:1});
 const before=allocateWeek(s);s.myTeam.roster[1].rosValue=999;
 assert.deepEqual(allocateWeek(s),before);
 const m=compareMove(s,s.freeAgents[0],s.myTeam.roster[1]);s.freeAgents[0].gameDates.push('2026-10-07');
 const n=compareMove(s,s.freeAgents[0],s.myTeam.roster[1]);assert.equal(m.rosChange,n.rosChange);assert.equal(n.gamesChange,m.gamesChange+1);
});
test('unknown, invalid and incomplete inputs never fabricate usable production',()=>{
 const s=state([player('a',['C'],undefined)],[player('add',['C'],dates)]);
 assert.equal(allocateWeek(s).available,false);assert.deepEqual(seasonMoves(s),[]);
 s.myTeam.roster[0].gameDates=[];assert.equal(allocateWeek(s).usable,0);
 s.myTeam.roster[0].gameDates=['2026-02-30'];assert.equal(allocateWeek(s).available,false);
 assert.equal(normalizeSeasonState(s).myTeam.roster[0].gameDates,undefined);
 s.myTeam.roster[0].gameDates=dates;s.myTeam.roster[0].perGame.G=undefined;
 assert.equal(allocateWeek(s).production,null);assert.deepEqual(seasonMoves(s),[]);
 delete s.weekDates;assert.equal(allocateWeek(s).available,false);
});
test('date normalization deduplicates, rejects out-of-week data, ignores completed dates and goalies',()=>{
 const s=state([player('a',['C'],[dates[0],dates[0],dates[1]])]);
 s.weekDates.remainingFrom=dates[1];s.myTeam.roster.push({...player('goalie',['G'],undefined),kind:'goalie'});
 const clean=normalizeSeasonState(s);assert.equal(clean.myTeam.roster[0].gameDates.length,2);
 assert.equal(allocateWeek(clean).scheduled,1);assert.equal(allocateWeek(clean).usable,1);
 s.myTeam.roster[0].gameDates=['2026-10-12'];assert.equal(allocateWeek(s).available,false);
});
test('input ordering preserves assignments and category production',()=>{
 const a=allocateWeek(fixture),b=allocateWeek({...fixture,myTeam:{...fixture.myTeam,roster:[...fixture.myTeam.roster].reverse()}});
 assert.deepEqual(a.days,b.days);assert.deepEqual(a.production,b.production);

});
