const {load}=require('./load.cjs');
const {test}=require('node:test');const assert=require('node:assert/strict');
const ts=require('typescript'),Module=require('node:module'),path=require('node:path');
const frozen=require('./fixtures/stage5-legacy.json');
const engine=load('src/lib/model/legacy.ts');
let text=frozen.prefix;const names=['baseRankedPlayers','teamCategoryStrength','teamNeedWeights','tierGroups','rankedPlayers','finalRankedPlayers'];
const args=['players,leagueTeams','baseMyTeamPlayers','baseMyTeamPlayers,teamCategoryStrength','baseRankedPlayers,draftedIds','baseRankedPlayers,currentRound,tierGroups,teamNeedWeights','{rankedPlayers,draftedIds,fantasyTeams,leagueTeamPlayers,draftPicks,leagueTeams,myDraftSlot,openStarterPositions,playoffSchedule,scheduleAverages,currentRound,myTeamPlayers}'];
names.forEach((name,i)=>text+=`\nexport function ${name}(${args[i]}) ${frozen.bodies[name]}\n`);
const mod=new Module(path.resolve('tests/original-stage5.cjs'),module);mod.filename=path.resolve('tests/original-stage5.cjs');mod.paths=module.paths;mod._compile(ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,mod.filename);
const original=mod.exports;
const players=Array.from({length:300},(_,i)=>({id:`p${i}`,name:`Player ${i}`,team:'EDM',positions:[['C'],['LW'],['RW'],['D'],['C','LW']][i%5],age:20+i%22,gp:82,goals:Math.max(0,50-i*.13),assists:80-i*.21,points:130-i*.34,ppp:60-i*.18,sog:350-i*.9,hits:(i*41)%250,blocks:(i*17)%200}));
const teams=Array.from({length:12},(_,i)=>({id:`team-${i+1}`,name:`Team ${i+1}`,isMyTeam:i===0}));
for(const count of [0,12,30,60,100])test(`frozen production ranking and contribution parity at ${count} selections`,()=>{
 const run=(base,strength,weights,tiers,first,final)=>{
 const ranked=base(players,12),draftedIds=new Set(players.slice(0,count).map(p=>p.id)),own=ranked.slice(0,count).filter((_,i)=>i%12===0);
 const round=Math.floor(count/12)+1,pass=first(ranked,round,tiers(ranked,draftedIds),weights(own,strength(own)));
 const picks=players.slice(0,count).map((p,i)=>({playerId:p.id,fantasyTeamId:teams[i%12].id,pickNumber:i+1}));
 const league=new Map(teams.map(t=>[t.id,picks.filter(p=>p.fantasyTeamId===t.id).map(p=>pass.find(x=>x.id===p.playerId))]));
 return final({rankedPlayers:pass,draftedIds,fantasyTeams:teams,leagueTeamPlayers:league,draftPicks:picks,leagueTeams:12,myDraftSlot:1,openStarterPositions:['C','LW','RW','D'],playoffSchedule:{},scheduleAverages:{seasonOffNightGames:0,playoffOffNightGames:0},currentRound:round,myTeamPlayers:league.get('team-1')});
 };
 const expected=run(...names.map(n=>original[n]));const actual=run(engine.legacyBase,engine.legacyStrength,engine.legacyWeights,engine.legacyTiers,engine.legacyFirstPass,engine.legacyFinal);
 assert.deepEqual(actual.map(p=>{const copy={...p};delete copy.contributions;return copy;}),expected);
 for(const p of actual)assert.ok(Math.abs(Object.values(p.contributions).reduce((a,b)=>a+b,0)-p.score)<1e-10);
 assert.deepEqual([...actual].sort((a,b)=>b.score-a.score).map(p=>p.id),[...expected].sort((a,b)=>b.score-a.score).map(p=>p.id));
});
