import type {SeasonProviderSnapshot} from '../season/provider';
import {CATEGORIES, validDate, type Category, type SeasonPlayer, type Totals} from '../season/state';

type ObjectValue = Record<string,unknown>;
const object=(v:unknown):v is ObjectValue=>!!v&&typeof v==='object'&&!Array.isArray(v);
/** Yahoo resource metadata is split across arrays; merge only direct fragments. */
function fields(v:unknown):ObjectValue {
  if(object(v))return v;
  if(Array.isArray(v))return Object.assign({},...v.map(fields));
  return {};
}
/** Locate semantic resource keys through Yahoo's numeric collection wrappers. */
function resources(v:unknown,key:string):unknown[]{
  if(Array.isArray(v))return v.flatMap(x=>resources(x,key));
  if(!object(v))return [];
  return Object.entries(v).flatMap(([k,x])=>k===key?[x]:resources(x,key));
}
const text=(v:unknown)=>typeof v==='string'&&v.trim()?v.trim():undefined;
const numeric=(v:unknown)=>typeof v==='number'?Number.isFinite(v)?v:undefined:
  typeof v==='string'&&/^\d*(?:\.\d+)?$/.test(v.trim())&&v.trim()?Number(v):undefined;
const positiveInt=(v:unknown)=>{const n=numeric(v);return n!==undefined&&Number.isInteger(n)&&n>0?n:undefined;};
function required(v:unknown,label:string):string {const s=text(v);if(!s)throw new YahooSeasonError(`Missing ${label}`);return s;}
function key(v:unknown,label:string):string {const s=required(v,label);if(!/^\d+\.(?:l|t|p)\.\d+(?:\.t\.\d+)?$/.test(s))throw new YahooSeasonError(`Invalid ${label}`);return s;}
function one(v:unknown,label:string):ObjectValue {const r=resources(v,label);if(r.length!==1)throw new YahooSeasonError(`Expected one ${label} resource`);return fields(r[0]);}
function collection(v:unknown,singular:string):unknown[]{
  if(v===undefined)throw new YahooSeasonError(`Missing ${singular} collection`);
  const found=resources(v,singular),count=numeric(fields(v).count);
  if(count!==undefined&&count!==found.length)throw new YahooSeasonError(`Incomplete ${singular} collection`);
  if(!found.length&&count!==0&&!(Array.isArray(v)&&v.length===0))throw new YahooSeasonError(`Malformed ${singular} collection`);
  return found;
}
export class YahooSeasonError extends Error {
  constructor(message:string,public status=422,public choices?:{key:string;name:string}[]){super(message);}
}
export function selectLeague(payload:unknown,season:number){
  const leagues=resources(payload,'league').map(fields).filter(l=>numeric(l.season)===season);
  if(!leagues.length)throw new YahooSeasonError(`No NHL league with explicit season ${season}`);
  const choices=leagues.map(l=>({key:key(l.league_key,'league key'),name:required(l.name,'league name')}));
  if(leagues.length!==1)throw new YahooSeasonError('Multiple current NHL leagues; explicit selection required',409,choices);
  const l=leagues[0];
  return {key:choices[0].key,id:text(l.league_id),name:choices[0].name,season,week:positiveInt(l.current_week),teams:positiveInt(l.num_teams)};
}
export function parseSettings(payload:unknown){
  const settings=one(payload,'settings'),rosterSlots:Record<string,number>={},statMap:Record<string,Category>={};
  for(const value of collection(settings.roster_positions,'roster_position')){
    const r=fields(value),position=required(r.position,'roster position'),count=numeric(r.count);
    if(count===undefined||!Number.isInteger(count)||count<0||count>20||position in rosterSlots)throw new YahooSeasonError('Invalid roster slot count');
    rosterSlots[position]=count;
  }
  const stats=fields(settings.stat_categories).stats;
  for(const value of collection(stats,'stat')){
    const s=fields(value);if(s.enabled!==undefined&&String(s.enabled)==='0')continue;
    const display=required(s.display_name,'category display name');
    const alias:Record<string,Category>={Pts:'P',PTS:'P',Shutouts:'SO',SHO:'SO'};
    const category=alias[display]??display;
    if(!CATEGORIES.includes(category as Category))throw new YahooSeasonError(`Unsupported enabled category: ${display}`);
    const id=String(s.stat_id??'');if(!/^\d+$/.test(id)||id in statMap)throw new YahooSeasonError('Invalid category stat ID');
    statMap[id]=category as Category;
  }
  if(!Object.keys(rosterSlots).length||!Object.keys(statMap).length)throw new YahooSeasonError('Empty league settings');
  if(new Set(Object.values(statMap)).size!==Object.values(statMap).length)throw new YahooSeasonError('Ambiguous category mapping');
  return {rosterSlots,statMap,categories:Object.values(statMap)};
}
function teamInfo(t:ObjectValue){return {id:key(t.team_key,'team key'),name:required(t.name,'team name'),yahooId:text(t.team_id)};}
export function selectMyTeam(payload:unknown){
  const teams=resources(payload,'team').map(fields).filter(t=>String(t.is_owned_by_current_login)==='1');
  if(teams.length!==1)throw new YahooSeasonError('Expected one team owned by the logged-in user',409);
  return teamInfo(teams[0]);
}
export function parseRoster(payload:unknown){
  const roster=one(payload,'roster'),details:Record<string,{yahooId?:string;selectedPosition?:string;status?:string}>={};
  const players=collection(roster.players,'player').map(value=>{
    const p=fields(value),id=key(p.player_key,'player key'),name=required(fields(p.name).full,'player name');
    const positions=resources(p.eligible_positions,'position').map(v=>required(v,'eligible position'));
    if(!positions.length)throw new YahooSeasonError(`Missing eligible positions for ${id}`);
    const positionType=text(p.position_type);
    if(positionType!=='G'&&positionType!=='P')throw new YahooSeasonError(`Unsupported player position type for ${id}`);
    if(details[id])throw new YahooSeasonError('Duplicate roster player');
    details[id]={yahooId:text(p.player_id),selectedPosition:text(fields(p.selected_position).position),status:text(p.status)};
    return {id,name,team:required(p.editorial_team_abbr,'NHL team'),positions:[...new Set(positions)],kind:positionType==='G'?'goalie':'skater'} as SeasonPlayer;
  });
  return {players,details};
}
function totals(team:ObjectValue,week:number,statMap:Record<string,Category>):Totals|undefined {
  if(team.team_stats===undefined)return undefined;
  const stats=fields(team.team_stats);
  if(stats.coverage_type!=='week'||positiveInt(stats.week)!==week)throw new YahooSeasonError('Matchup totals are not for the requested week');
  const result:Totals={};
  for(const value of collection(stats.stats,'stat')){
    const s=fields(value),category=statMap[String(s.stat_id)];if(!category)continue;
    const n=numeric(s.value);if(n===undefined)continue;
    if(n<0||(category==='SV%'&&n>1))throw new YahooSeasonError('Invalid matchup category value');
    if(result[category]!==undefined)throw new YahooSeasonError('Duplicate matchup category');
    result[category]=n;
  }
  return result;
}
export function parseMatchup(payload:unknown,myKey:string,week:number,statMap:Record<string,Category>){
  const scoreboard=one(payload,'scoreboard');
  if(positiveInt(scoreboard.week)!==week)throw new YahooSeasonError('Scoreboard week mismatch');
  const matches=collection(scoreboard.matchups,'matchup').map(fields).filter(m=>resources(m.teams,'team').some(t=>fields(t).team_key===myKey));
  if(matches.length===0)return undefined; // Explicitly no matchup, e.g. a bye; not an invented opponent.
  if(matches.length!==1)throw new YahooSeasonError('Ambiguous current matchup');
  const match=matches[0];if(positiveInt(match.week)!==week)throw new YahooSeasonError('Matchup week mismatch');
  const teams=collection(match.teams,'team').map(fields);
  if(teams.length!==2||new Set(teams.map(t=>t.team_key)).size!==2)throw new YahooSeasonError('Unsupported matchup teams');
  const mine=teams.find(t=>t.team_key===myKey)!,opponent=teams.find(t=>t.team_key!==myKey)!;
  const start=text(match.week_start),end=text(match.week_end);
  return {opponent:teamInfo(opponent),mine:totals(mine,week,statMap),theirs:totals(opponent,week,statMap),
    dates:start&&end&&validDate(start)&&validDate(end)?{start,end}:undefined};
}
export type YahooGet=(path:string)=>Promise<unknown>;
/** Network orchestration accepts only fixed Yahoo paths and validated resource keys. */
export async function readYahooSeason(get:YahooGet,season:number,asOf=new Date().toISOString()){
  const league=selectLeague(await get('users;use_login=1/games;game_codes=nhl/leagues'),season);
  const [settingsPayload,teamsPayload]=await Promise.all([get(`league/${league.key}/settings`),get(`league/${league.key}/teams`)]);
  const settings=parseSettings(settingsPayload),mine=selectMyTeam(teamsPayload);
  const myRoster=parseRoster(await get(`team/${mine.id}/roster`));
  const matchup=league.week===undefined?undefined:parseMatchup(await get(`league/${league.key}/scoreboard;week=${league.week}`),mine.id,league.week,settings.statMap);
  const opponentRoster=matchup?parseRoster(await get(`team/${matchup.opponent.id}/roster`)):undefined;
  const snapshot:SeasonProviderSnapshot={
    source:{kind:'provider',label:'Yahoo Fantasy Hockey',asOf,notes:'Read-only current rosters and weekly observed totals. No projections, schedules or free-agent retrieval.'},
    week:league.week,leagueTeams:league.teams,categories:settings.categories,rosterSlots:settings.rosterSlots,
    myTeam:{id:mine.id,name:mine.name,roster:myRoster.players,current:matchup?.mine},
    opponent:matchup?{id:matchup.opponent.id,name:matchup.opponent.name,roster:opponentRoster?.players,current:matchup.theirs}:undefined,
  };
  return {league,myTeam:mine,opponent:matchup?.opponent,matchupDates:matchup?.dates,
    rosterDetails:{mine:myRoster.details,opponent:opponentRoster?.details},snapshot};
}
