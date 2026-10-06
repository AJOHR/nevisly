import {validDate} from '../season/state';
export type NhlGame={id:number;date:string;team:string;opponent:string;gameType:2};
const teams=new Set('ANA BOS BUF CAR CBJ CGY CHI COL DAL DET EDM FLA LAK MIN MTL NJD NSH NYI NYR OTT PHI PIT SEA SJS STL TBL TOR UTA VAN VGK WPG WSH'.split(' '));
export function nhlTeam(value:string):string|undefined{const t=value.toUpperCase().replaceAll('.','');const aliases:Record<string,string>={LA:'LAK',NJ:'NJD',SJ:'SJS',TB:'TBL',MON:'MTL',WAS:'WSH',UTAH:'UTA'};const result=aliases[t]??t;return teams.has(result)?result:undefined;}
export function parseNhlSchedule(payload:unknown,team:string):NhlGame[]{
 const data=payload as {games?:{id:number;gameType:number;season:number;gameDate:string;homeTeam:{abbrev:string};awayTeam:{abbrev:string}}[]};
 if(!data||!Array.isArray(data.games))throw Error('Missing NHL games collection');
 const seen=new Set<number>();
 return data.games.filter(g=>g.gameType===2).map(g=>{
  if(g.season!==20262027||!Number.isInteger(g.id)||seen.has(g.id)||!validDate(g.gameDate)||![g.homeTeam?.abbrev,g.awayTeam?.abbrev].includes(team))throw Error('Invalid NHL regular-season game');
  seen.add(g.id);return {id:g.id,date:g.gameDate,team,opponent:g.homeTeam.abbrev===team?g.awayTeam.abbrev:g.homeTeam.abbrev,gameType:2 as const};
 }).sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id);
}
/** NHL gameDate is the published league calendar date, not UTC start-time date. */
export async function readSchedules(teamNames:string[],get:(team:string)=>Promise<unknown>){
 const schedules:Record<string,NhlGame[]>={},errors:Record<string,string>={};
 const unique=[...new Set(teamNames.map(nhlTeam).filter((t):t is string=>!!t))];
 // Four concurrent requests maximum, once per team, backed by server fetch caching.
 for(let i=0;i<unique.length;i+=4)await Promise.all(unique.slice(i,i+4).map(async team=>{
  try{schedules[team]=parseNhlSchedule(await get(team),team);}catch{errors[team]='NHL schedule unavailable or invalid';}
 }));
 return {schedules,errors};
}
export function leagueDate(now:Date,timeZone:string){
 if(!timeZone)throw Error('An explicit league calendar timezone is required');
 const parts=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const value=(k:string)=>parts.find(p=>p.type===k)?.value;
 return `${value('year')}-${value('month')}-${value('day')}`;
}
