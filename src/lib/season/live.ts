import type {SkaterProjection} from '@/types/player';
import {normalizePlayerName} from '../projections/identity';
import {hasProjectionValue} from '../projections/quality';
import {replacementValues} from '../model/replacement';
import {modelConfig} from '../model/config';
import {composeSeasonState,type SeasonProviderSnapshot} from './provider';
import {seasonConfiguration} from './config';
import {allocateWeek} from './lineup';
import {SKATER_CATEGORIES,type SeasonPlayer} from './state';
import {nhlTeam,type NhlGame} from '../nhl/seasonSchedule';
import type {YahooPlayerFacts} from '../yahoo/live';
export type LiveSeasonData={snapshot:SeasonProviderSnapshot;facts:Record<string,YahooPlayerFacts>;
 schedules:Record<string,NhlGame[]>;scheduleErrors:Record<string,string>;
 matchupDates?:{start:string;end:string};calendarDate:string;timeZone:string;availableCount:number;
 league:{key:string;name:string};warnings?:string[];};
const statFields={G:'goals',A:'assists',P:'points',PPP:'ppp',SOG:'sog',HIT:'hits',BLK:'blocks'} as const;
/** Exact normalized name + compatible position. Team trades never veto a unique
 * identity; duplicate names never resolve by picking the first or guessing team.
 */
export function matchProjection(player:SeasonPlayer,projections:SkaterProjection[]){
 const matches=projections.filter(p=>normalizePlayerName(p.name)===normalizePlayerName(player.name)&&p.positions.some(pos=>player.positions.includes(pos)));
 return matches.length===1?matches[0]:undefined;
}
export function composeLiveSeason(data:LiveSeasonData,projections:SkaterProjection[]){
 const snapshot=data.snapshot,dates=data.matchupDates;
 const issues:string[]=[...(data.warnings??[])],unmatched:string[]=[],missingSchedule:string[]=[];
 const compatible=SKATER_CATEGORIES.every(c=>snapshot.categories?.includes(c))&&Object.keys(snapshot.rosterSlots??{}).every(p=>['C','LW','RW','D','G','BN','IR','IR+'].includes(p));
 // Reuse intrinsic projection Player Value only, never draft timing or Team Fit.
 // This is a full-season projection value proxy, not a live ROS reforecast.
 const values=new Map<string,number>();
 if(compatible&&snapshot.leagueTeams&&Object.values(snapshot.rosterSlots??{}).some(n=>n>0)){
  const config={...modelConfig,starters:Object.fromEntries(['C','LW','RW','D'].map(p=>[p,snapshot.rosterSlots?.[p]??0]))};
  if(Object.values(config.starters).some(n=>n>0))for(const p of replacementValues(projections,snapshot.leagueTeams,config).ranked)values.set(p.id,p.vor);
 }else issues.push('Current projection value supports the seven configured skater categories and C/LW/RW/D slots only.');
 const allPlayers=[...(snapshot.myTeam?.roster??[]),...(snapshot.opponent?.roster??[]),...(snapshot.freeAgents??[])];
 const linkedIds=allPlayers.filter(p=>p.kind==='skater').map(p=>matchProjection(p,projections)?.id);
 const collisions=new Set(linkedIds.filter((id,i)=>id!==undefined&&linkedIds.indexOf(id)!==i));
 let matched=0,skaters=0;
 const enrich=(p:SeasonPlayer):SeasonPlayer=>{
  const team=nhlTeam(p.team),schedule=team?data.schedules[team]:undefined;
  const gameDates=dates&&schedule?schedule.filter(g=>g.date>=dates.start&&g.date<=dates.end).map(g=>g.date):undefined;
  if(p.kind==='skater'&&!gameDates)missingSchedule.push(p.name);
  if(p.kind==='goalie')return {...p,gameDates};
  skaters++;const projection=matchProjection(p,projections);
  if(!projection||collisions.has(projection.id)||!hasProjectionValue(projection,'gp')||projection.gp<=0||!SKATER_CATEGORIES.every(c=>hasProjectionValue(projection,statFields[c]))){unmatched.push(p.name);return {...p,gameDates};}
  matched++;
  return {...p,gameDates,rosValue:values.get(projection.id),perGame:Object.fromEntries(SKATER_CATEGORIES.map(c=>[c,projection[statFields[c]]/projection.gp]))};
 };
 const myRoster=snapshot.myTeam?.roster?.map(enrich),opponentRoster=snapshot.opponent?.roster?.map(enrich),available=snapshot.freeAgents?.map(enrich);
 const freeAgents=available?.filter(p=>['FA','freeagents'].includes(data.facts[p.id]?.ownership??''));
 const excludedAvailability=(available?.length??0)-(freeAgents?.length??0);
 if(excludedAvailability)issues.push(`${excludedAvailability} waiver/unknown-ownership players retained in diagnostics, excluded from immediately actionable moves.`);
 if(!dates)issues.push('Yahoo matchup dates unavailable.');
 if(dates&&data.calendarDate>dates.end)issues.push('Matchup has ended; refresh after Yahoo advances the week.');
 const weekDates=dates&&data.calendarDate<=dates.end?{...dates,remainingFrom:data.calendarDate<dates.start?dates.start:data.calendarDate}:undefined;
 const composed=composeSeasonState({...snapshot,weekDates,freeAgents,
  source:snapshot.source?{...snapshot.source,notes:`Yahoo facts; NHL regular-season dates; uploaded Nevisly projection blend. Calendar: ${data.timeZone}. Includes today; intraday locks/completed games are not modeled. ROS is an intrinsic full-season projection value proxy, not a live ROS forecast. Statuses do not predict missed games.`}:undefined,
  myTeam:snapshot.myTeam?{...snapshot.myTeam,roster:myRoster,remaining:{}}:undefined,
  opponent:snapshot.opponent?{...snapshot.opponent,roster:opponentRoster,remaining:{}}:undefined,
 },seasonConfiguration);
 if(composed.available){
  const state=composed.state;
  const opponent=allocateWeek({...state,myTeam:state.opponent,opponent:state.myTeam});
  if(opponent.available&&opponent.production)state.opponent.remaining=opponent.production;
 }
 return {composition:composed,coverage:{matched,skaters,unmatched,missingSchedule,excludedAvailability},issues};
}
