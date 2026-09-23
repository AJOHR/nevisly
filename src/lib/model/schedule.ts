import type { SkaterProjection } from '@/types/player';
import type { PlayoffScheduleMap, TeamSchedule } from '@/lib/draft/playoffSchedule';
import { categories, modelConfig, type CategoryValues } from './config';
import { allocate, rosterSlots } from './allocation';

const weeks = ['24','25','26'];
const aliases:Record<string,string>={TB:'TBL',LA:'LAK',NJ:'NJD',SJ:'SJS',WAS:'WSH',CLB:'CBJ',MON:'MTL'};
export function scheduleFor(team:string, schedules:PlayoffScheduleMap) {
  const key=team.trim().toUpperCase();return schedules[key]??schedules[aliases[key]];
}

type ScheduleOpportunity = {
  games:number;
  seasonGames:number;
  dates:string[]|null;
};

function opportunity(schedule:TeamSchedule|undefined):ScheduleOpportunity|null {
  if(!schedule || !Number.isFinite(schedule.seasonGames) || schedule.seasonGames<=0)return null;
  const rows=weeks.map(w=>schedule.playoffByWeek[w]);
  if(rows.some(w=>!w || !Number.isFinite(w.games) || w.games<0 || !Number.isFinite(w.offNightGames) || w.offNightGames<0 || w.offNightGames>w.games))return null;
  const games=rows.reduce((n,w)=>n+w.games,0);
  if(games>schedule.seasonGames)return null;
  const dates=Array.isArray(schedule.playoffDates)
    ? [...new Set(schedule.playoffDates.filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)))].sort()
    : [];
  return {games,seasonGames:schedule.seasonGames,dates:dates.length===games?dates:null};
}

type SchedulePlayer = SkaterProjection & {rawScore?:number};
type RosterOpportunity = {
  score:number;
  totalStarts:number;
  starts:Map<string,number>;
  exact:boolean;
  available:boolean;
};

/**
 * Playoff schedule value is measured against the league-average Weeks 24-26
 * game count. With exact dates, each day is allocated through the real C/LW/RW/D
 * starter graph, so multi-position eligibility only helps when it prevents an
 * actual busy-night benching conflict. Older aggregate payloads retain a
 * game-count fallback without inventing daily flexibility.
 *
 * Season projections already include expected availability. Per scheduled-game
 * production therefore divides by NHL team games, not projected GP.
 */
export function prepareScheduleOpportunity(
  players:SchedulePlayer[],
  schedules:PlayoffScheduleMap,
  deviations:CategoryValues
) {
  const byId=new Map(players.map(p=>[p.id,p]));
  const validSchedules=Object.values(schedules).map(opportunity).filter((x):x is ScheduleOpportunity=>!!x);
  const averageGames=validSchedules.length
    ? validSchedules.reduce((n,s)=>n+s.games,0)/validSchedules.length
    : 0;
  const slots=rosterSlots(modelConfig.starters);
  const perGameCache=new Map<string,number>();
  const rosterCache=new Map<string,RosterOpportunity>();

  const perGame=(player:SchedulePlayer)=>{
    const cached=perGameCache.get(player.id);if(cached!==undefined)return cached;
    const s=opportunity(scheduleFor(player.team,schedules));
    if(!s){perGameCache.set(player.id,0);return 0;}
    const value=categories.reduce((sum,c)=>sum+(deviations[c]>0?player[c]/deviations[c]:0),0)/s.seasonGames;
    perGameCache.set(player.id,value);return value;
  };

  const rosterOpportunity=(ids:readonly string[]):RosterOpportunity=>{
    const key=[...new Set(ids)].sort().join('|');
    const cached=rosterCache.get(key);if(cached)return cached;
    const roster=[...new Set(ids)].flatMap(id=>byId.get(id)?[byId.get(id)!]:[]);
    if(!averageGames || roster.length!==new Set(ids).size) {
      const unavailable={score:0,totalStarts:0,starts:new Map<string,number>(),exact:false,available:false};
      rosterCache.set(key,unavailable);return unavailable;
    }
    const schedulesForRoster=roster.map(p=>opportunity(scheduleFor(p.team,schedules)));
    if(schedulesForRoster.some(s=>!s)) {
      const unavailable={score:0,totalStarts:0,starts:new Map<string,number>(),exact:false,available:false};
      rosterCache.set(key,unavailable);return unavailable;
    }

    const starts=new Map<string,number>(roster.map(p=>[p.id,0]));
    const exact=schedulesForRoster.every(s=>!!s?.dates);
    if(exact) {
      const dates=[...new Set(schedulesForRoster.flatMap(s=>s?.dates??[]))].sort();
      for(const date of dates) {
        const active=roster.flatMap((player,index)=>{
          const s=schedulesForRoster[index]!;
          return s.dates?.includes(date)?[{...player,rawScore:perGame(player)}]:[];
        });
        const assigned=allocate(active,slots);
        for(const player of assigned.values())starts.set(player.id,(starts.get(player.id)??0)+1);
      }
    } else {
      // Backward-compatible aggregate payload: preserve game-volume economics,
      // but do not fabricate daily congestion or a flexibility bonus.
      roster.forEach((player,index)=>starts.set(player.id,schedulesForRoster[index]!.games));
    }

    let score=0,totalStarts=0;
    for(const player of roster) {
      const playerStarts=starts.get(player.id)??0;
      totalStarts+=playerStarts;
      score+=(playerStarts-averageGames)*perGame(player);
    }
    const result={score,totalStarts,starts,exact,available:true};
    rosterCache.set(key,result);return result;
  };

  return (player:SchedulePlayer,beforeStarterIds:readonly string[],afterStarterIds:readonly string[])=>{
    const current=opportunity(scheduleFor(player.team,schedules));
    const neutral={adjustment:0,games:current?.games,extraStarts:0,usableStarts:0,available:false,exact:false};
    if(!current || !beforeStarterIds.length || !afterStarterIds.length)return neutral;
    const before=rosterOpportunity(beforeStarterIds),after=rosterOpportunity(afterStarterIds);
    if(!before.available||!after.available)return neutral;
    return {
      adjustment:after.score-before.score,
      games:current.games,
      extraStarts:after.totalStarts-before.totalStarts,
      usableStarts:after.starts.get(player.id)??0,
      available:true,
      exact:before.exact&&after.exact,
    };
  };
}
