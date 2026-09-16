const {load}=require('./load.cjs');
exports.players=Array.from({length:300},(_,i)=>{
 const position=['C','LW','RW','D'][i%4],tier=Math.floor(i/4),scale=Math.max(.12,1-tier/90);
 return {id:`p${String(i).padStart(3,'0')}`,name:`Fixture ${i}`,team:'EDM',positions: i%13===0 ? ['C','LW','RW']:[position],age:24+i%16,gp:82,
 goals:(position==='D'?16:45)*scale,assists:(position==='D'?60:75)*scale,points:(position==='D'?76:120)*scale,ppp:42*scale,sog:300*scale,
 hits:(i%5===0?260:60)*scale,blocks:(position==='D'?190:45)*scale};
});
exports.players[0]={...exports.players[0],name:'Elite forward'};
exports.players[3]={...exports.players[3],name:'Premium D'};
exports.players[5]={...exports.players[5],name:'Power forward',goals:42,assists:42,points:84,hits:300,sog:300,blocks:40};
exports.players[9]={...exports.players[9],name:'Hits specialist',goals:8,assists:12,points:20,ppp:2,sog:90,hits:380,blocks:30};
exports.teams=Array.from({length:12},(_,i)=>({id:`team-${i+1}`,name:`Team ${i+1}`,isMyTeam:i===0}));
exports.context=(base, count=0)=>{
 const e=load('src/lib/model/legacy.ts');
 const picks=exports.players.slice(15,15+count).map((p,i)=>({playerId:p.id,fantasyTeamId:exports.teams[i%12].id,pickNumber:i+1}));
 const ids=new Set(picks.map(p=>p.playerId)),own=base.filter(p=>picks.some(d=>d.playerId===p.id&&d.fantasyTeamId==='team-1'));
 const currentRound=Math.floor(count/12)+1;
 const rankedPlayers=e.legacyFirstPass(base,currentRound,e.legacyTiers(base,ids),e.legacyWeights(own,e.legacyStrength(own)));
 const league=new Map(exports.teams.map(t=>[t.id,rankedPlayers.filter(p=>picks.some(d=>d.playerId===p.id&&d.fantasyTeamId===t.id))]));
 return {rankedPlayers,draftedIds:ids,fantasyTeams:exports.teams,leagueTeamPlayers:league,draftPicks:picks,leagueTeams:12,myDraftSlot:1,openStarterPositions:['C','LW','RW','D'],playoffSchedule:{},scheduleAverages:{seasonOffNightGames:0,playoffOffNightGames:0},currentRound,myTeamPlayers:league.get('team-1')};
};
