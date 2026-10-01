import {allocate,rosterSlots} from '../model/allocation';
import {SKATER_CATEGORIES,validDate,validWeek,type SeasonLeagueState,type SeasonPlayer,type SkaterCategory} from './state';
export type DailyLineup={date:string; assignments:{slot:string;playerId:string}[]; benchedIds:string[]};
export type WeeklyLineup={available:true;scheduled:number;usable:number;benched:number;days:DailyLineup[];
 players:Record<string,{scheduled:number;usable:number;dates:string[]}>;
 production:Record<SkaterCategory,number>|null};
export type LineupResult=WeeklyLineup|{available:false;reason:string};
const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
/** Fixed current-category priorities for both sides of a proposed swap. No ROS input.
 * Close/Swing (within +1/-2 swing units): full weight; other known gaps: quarter weight.
 * Production in unknown categories is not assigned an invented priority.
 */
export function lineupPriority(state:SeasonLeagueState,p:SeasonPlayer):number {
 return SKATER_CATEGORIES.reduce((score,c)=>{
  const mine=state.myTeam.current[c],other=state.opponent.current[c],unit=state.swingUnits[c],rate=p.perGame?.[c];
  if(!finite(mine)||!finite(other)||!finite(rate)||!finite(unit)||unit===0)return score;
  const gap=(mine-other)/unit;
  return score+rate/unit*(gap>=-2&&gap<=1?1:.25);
 },0);
}
/** Maximum-cardinality daily matching, then maximum fixed category-weight production.
 * Exact for supplied dates/eligibility; not a forecast of injuries, locks or goalie starts.
 */
export function allocateWeek(state:SeasonLeagueState,roster:readonly SeasonPlayer[]=state.myTeam.roster):LineupResult {
 const week=state.weekDates;
 if(!validWeek(week))return {available:false,reason:'Missing or invalid matchup-week dates'};
 const skaters=roster.filter(p=>p.kind==='skater');
 if(new Set(skaters.map(p=>p.id)).size!==skaters.length)return {available:false,reason:'Duplicate roster identity'};
 for(const p of skaters)if(!p.gameDates||p.gameDates.some(d=>!validDate(d)||d<week!.start||d>week!.end))return {available:false,reason:`Missing or invalid schedule: ${p.name}`};
 const counts=Object.fromEntries(['C','LW','RW','D'].map(pos=>[pos,state.rosterSlots[pos]??0]));
 if(Object.values(counts).some(n=>!Number.isInteger(n)||n<0||n>20)||!Object.values(counts).some(n=>n>0))return {available:false,reason:'Invalid skater starter slots'};
 const slots=rosterSlots(counts);
 const players:WeeklyLineup['players']={};
 const weighted=skaters.map(p=>{
  const dates=[...new Set(p.gameDates!)].filter(d=>d>=week!.remainingFrom).sort();
  players[p.id]={scheduled:dates.length,usable:0,dates:[]};
  return {...p,gameDates:dates,rawScore:lineupPriority(state,p)};
 });
 const dates=[...new Set(weighted.flatMap(p=>p.gameDates))].sort();
 const production=Object.fromEntries(SKATER_CATEGORIES.map(c=>[c,0])) as Record<SkaterCategory,number>;
 // Missing projections can still yield exact counts, but cannot support category forecasts.
 const complete=skaters.every(p=>SKATER_CATEGORIES.every(c=>finite(p.perGame?.[c])));
 const days=dates.map(date=>{
  const playing=weighted.filter(p=>p.gameDates.includes(date));
  const assigned=allocate(playing,slots),started=new Set([...assigned.values()].map(p=>p.id));
  for(const p of assigned.values()){
   players[p.id].usable++;players[p.id].dates.push(date);
   if(complete)for(const c of SKATER_CATEGORIES)production[c]+=p.perGame![c]!;
  }
  return {date,assignments:[...assigned].map(([slot,p])=>({slot,playerId:p.id})).sort((a,b)=>a.slot.localeCompare(b.slot)),benchedIds:playing.filter(p=>!started.has(p.id)).map(p=>p.id).sort()};
 });
 const scheduled=Object.values(players).reduce((n,p)=>n+p.scheduled,0),usable=Object.values(players).reduce((n,p)=>n+p.usable,0);
 return {available:true,scheduled,usable,benched:scheduled-usable,players,days,production:complete?production:null};
}
