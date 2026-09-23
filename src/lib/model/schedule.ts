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
  regularGames:number;
  playoffDates:string[]|null;
  regularDates:string[]|null;
};

function validDates(values:unknown) {
  return Array.isArray(values)
    ? [...new Set(values.filter((d):d is string=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)))].sort()
    : null;
}

function opportunity(schedule:TeamSchedule|undefined):ScheduleOpportunity|null {
  if(!schedule || !Number.isFinite(schedule.seasonGames) || schedule.seasonGames<=0)return null;
  const rows=weeks.map(w=>schedule.playoffByWeek[w]);
  if(rows.some(w=>!w || !Number.isFinite(w.games) || w.games<0 || !Number.isFinite(w.offNightGames) || w.offNightGames<0 || w.offNightGames>w.games))return null;
  const games=rows.reduce((n,w)=>n+w.games,0);
  if(games>schedule.seasonGames)return null;

  const playoffDates=validDates(schedule.playoffDates);
  const exactPlayoff=playoffDates&&playoffDates.length===games?playoffDates:null;

  const regularGames=Math.max(0,schedule.seasonGames-games);
  const rawRegularDates=validDates(schedule.regularSeasonDates);
  const regularDates=rawRegularDates&&rawRegularDates.length===regularGames?rawRegularDates:null;

  return {games,seasonGames:schedule.seasonGames,regularGames,playoffDates:exactPlayoff,regularDates};
}

type SchedulePlayer = SkaterProjection & {rawScore?:number};
type RosterOpportunity = {
  score:number;
  playoffScore:number;
  seasonScheduleScore:number;
  totalStarts:number;
  starts:Map<string,number>;
  regularStarts:Map<string,number>;
  exact:boolean;
  seasonExact:boolean;
  available:boolean;
};

/**
 * Schedule opportunity is roster-relative and only measures production made
 * usable or unusable by the calendar.
 *
 * Playoffs: allocate the projected roster on each exact Yahoo Weeks 24-26 date
 * and compare usable production with league-average playoff game volume.
 *
 * Regular season: allocate the projected roster on every exact non-playoff NHL
 * game date. Compare the actually usable production with the same roster's
 * unconstrained scheduled production. The resulting congestion loss is <= 0.
 * A favorable off-night schedule only helps by reducing that loss; it never
 * creates production on top of the season projection.
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

  const unavailable=():RosterOpportunity=>({
    score:0,playoffScore:0,seasonScheduleScore:0,totalStarts:0,
    starts:new Map<string,number>(),regularStarts:new Map<string,number>(),
    exact:false,seasonExact:false,available:false,
  });

  const rosterOpportunity=(ids:readonly string[]):RosterOpportunity=>{
    const key=[...new Set(ids)].sort().join('|');
    const cached=rosterCache.get(key);if(cached)return cached;
    const roster=[...new Set(ids)].flatMap(id=>byId.get(id)?[byId.get(id)!]:[]);
    if(!averageGames || roster.length!==new Set(ids).size) {
      const result=unavailable();rosterCache.set(key,result);return result;
    }
    const schedulesForRoster=roster.map(p=>opportunity(scheduleFor(p.team,schedules)));
    if(schedulesForRoster.some(s=>!s)) {
      const result=unavailable();rosterCache.set(key,result);return result;
    }

    const starts=new Map<string,number>(roster.map(p=>[p.id,0]));
    const exact=schedulesForRoster.every(s=>!!s?.playoffDates);
    if(exact) {
      const dates=[...new Set(schedulesForRoster.flatMap(s=>s?.playoffDates??[]))].sort();
      for(const date of dates) {
        const active=roster.flatMap((player,index)=>{
          const s=schedulesForRoster[index]!;
          return s.playoffDates?.includes(date)?[{...player,rawScore:perGame(player)}]:[];
        });
        const assigned=allocate(active,slots);
        for(const player of assigned.values())starts.set(player.id,(starts.get(player.id)??0)+1);
      }
    } else {
      // Backward-compatible aggregate playoff payload: preserve game-volume
      // economics, but do not fabricate daily congestion or flexibility.
      roster.forEach((player,index)=>starts.set(player.id,schedulesForRoster[index]!.games));
    }

    let playoffScore=0,totalStarts=0;
    for(let index=0;index<roster.length;index++) {
      const player=roster[index];
      const playerStarts=starts.get(player.id)??0;
      totalStarts+=playerStarts;
      playoffScore+=(playerStarts-averageGames)*perGame(player);
    }

    const regularStarts=new Map<string,number>(roster.map(p=>[p.id,0]));
    const seasonExact=schedulesForRoster.every(s=>!!s?.regularDates);
    let seasonScheduleScore=0;
    if(seasonExact) {
      const dates=[...new Set(schedulesForRoster.flatMap(s=>s?.regularDates??[]))].sort();
      let usableScore=0;
      for(const date of dates) {
        const active=roster.flatMap((player,index)=>{
          const s=schedulesForRoster[index]!;
          return s.regularDates?.includes(date)?[{...player,rawScore:perGame(player)}]:[];
        });
        const assigned=allocate(active,slots);
        for(const player of assigned.values()) {
          regularStarts.set(player.id,(regularStarts.get(player.id)??0)+1);
          usableScore+=perGame(player);
        }
      }

      // Intrinsic value already contains the projected season production. The
      // schedule term therefore measures only what daily-lineup congestion makes
      // unusable, never the production itself.
      const unconstrainedScore=roster.reduce((sum,player,index)=>
        sum+schedulesForRoster[index]!.regularGames*perGame(player),0);
      seasonScheduleScore=usableScore-unconstrainedScore;
    }

    const score=playoffScore+seasonScheduleScore;
    const result={score,playoffScore,seasonScheduleScore,totalStarts,starts,regularStarts,exact,seasonExact,available:true};
    rosterCache.set(key,result);return result;
  };

  return (player:SchedulePlayer,beforeRosterIds:readonly string[],afterRosterIds:readonly string[])=>{
    const currentSchedule=scheduleFor(player.team,schedules);
    const current=opportunity(currentSchedule);
    const neutral={
      adjustment:0,playoffAdjustment:0,seasonScheduleAdjustment:0,games:current?.games,
      seasonOffNightGames:currentSchedule?.seasonOffNightGames??0,
      extraStarts:0,usableStarts:0,extraRegularStarts:0,usableRegularStarts:0,
      available:false,exact:false,seasonExact:false,
    };
    if(!current || !beforeRosterIds.length || !afterRosterIds.length)return neutral;
    const before=rosterOpportunity(beforeRosterIds),after=rosterOpportunity(afterRosterIds);
    if(!before.available||!after.available)return neutral;

    const playoffAdjustment=after.playoffScore-before.playoffScore;
    const seasonScheduleAdjustment=after.seasonScheduleScore-before.seasonScheduleScore;
    return {
      adjustment:playoffAdjustment+seasonScheduleAdjustment,
      playoffAdjustment,
      seasonScheduleAdjustment,
      games:current.games,
      seasonOffNightGames:currentSchedule?.seasonOffNightGames??0,
      extraStarts:after.totalStarts-before.totalStarts,
      usableStarts:after.starts.get(player.id)??0,
      extraRegularStarts:[...after.regularStarts.values()].reduce((a,b)=>a+b,0)-[...before.regularStarts.values()].reduce((a,b)=>a+b,0),
      usableRegularStarts:after.regularStarts.get(player.id)??0,
      available:true,
      exact:before.exact&&after.exact,
      seasonExact:before.seasonExact&&after.seasonExact,
    };
  };
}
