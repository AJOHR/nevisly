import type { SkaterProjection } from '@/types/player';
import type { PlayoffScheduleMap, TeamSchedule } from '@/lib/draft/playoffSchedule';
import { categories, modelConfig, type CategoryValues } from './config';

const weeks = ['24','25','26'];
const aliases:Record<string,string>={TB:'TBL',LA:'LAK',NJ:'NJD',SJ:'SJS',WAS:'WSH',CLB:'CBJ',MON:'MTL'};
export function scheduleFor(team:string, schedules:PlayoffScheduleMap) {
  const key=team.trim().toUpperCase();return schedules[key]??schedules[aliases[key]];
}
function opportunity(schedule:TeamSchedule|undefined) {
  if(!schedule || !Number.isFinite(schedule.seasonGames) || schedule.seasonGames<=0)return null;
  const rows=weeks.map(w=>schedule.playoffByWeek[w]);
  if(rows.some(w=>!w || !Number.isFinite(w.games) || w.games<0 || !Number.isFinite(w.offNightGames) || w.offNightGames<0 || w.offNightGames>w.games))return null;
  const games=rows.reduce((n,w)=>n+w.games,0),off=rows.reduce((n,w)=>n+w.offNightGames,0);
  return games<=schedule.seasonGames?{games,off,seasonGames:schedule.seasonGames}:null;
}

/** Extra expected starts * projected production per scheduled season game.
 * Season projections already include availability: dividing by projected GP
 * would undo that adjustment. No season off-night or flat game-count bonus.
 * Busy-night sharing is a conservative capacity proxy, not a daily optimizer.
 */
export function prepareScheduleOpportunity(players:SkaterProjection[],own:SkaterProjection[],schedules:PlayoffScheduleMap,deviations:CategoryValues) {
  const known=players.flatMap(p=>{const s=opportunity(scheduleFor(p.team,schedules));return s?[{id:p.id,positions:p.positions,...s}]:[];});
  const knownIds=new Set(known.map(p=>p.id));
  const groups=new Map<string,{games:number;off:number;count:number;use:number}>();
  return (player:SkaterProjection)=>{
    const current=opportunity(scheduleFor(player.team,schedules));
    const neutral={adjustment:0,games:current?.games,extraStarts:0,available:!!current};
    if(!current)return neutral;
    const positions=[...new Set(player.positions)].filter(p=>modelConfig.starters[p]).sort();
    const key=positions.join('/');
    let group=groups.get(key);
    if(!group){
      const peers=known.filter(p=>p.positions.some(pos=>positions.includes(pos)));
      const capacity=positions.reduce((n,p)=>n+modelConfig.starters[p],0);
      // Only players confined to these slots must compete here; flexible
      // players with an outside slot are not counted as forced congestion.
      const demand=1+own.filter(p=>p.positions.every(pos=>positions.includes(pos))).length;
      group={games:peers.reduce((n,p)=>n+p.games,0),off:peers.reduce((n,p)=>n+p.off,0),count:peers.length,use:Math.min(1,capacity/demand)};
      groups.set(key,group);
    }
    const included=knownIds.has(player.id),count=group.count-Number(included);
    if(count<=0)return neutral;
    const typicalGames=(group.games-(included?current.games:0))/count;
    const typicalOff=(group.off-(included?current.off:0))/count;
    const extraStarts=(current.off-typicalOff)+group.use*((current.games-current.off)-(typicalGames-typicalOff));
    const perGame=categories.reduce((sum,c)=>sum+(deviations[c]>0?player[c]/deviations[c]:0),0)/current.seasonGames;
    return {adjustment:extraStarts*perGame,games:current.games,extraStarts,available:true};
  };
}
