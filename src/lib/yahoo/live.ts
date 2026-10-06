import {collection,fields,key,numeric,one,parseRoster,readYahooSeason,text,YahooSeasonError,type YahooGet} from './season';
import {validDate,type Category,type SeasonPlayer,type Totals} from '../season/state';
export type YahooPlayerFacts={
 source:'Yahoo Fantasy';asOf:string;displayPosition?:string;status?:string;statusFull?:string;
 selectedPosition?:string;hasPlayerNotes?:boolean;hasRecentPlayerNotes?:boolean;notesTimestamp?:string|number;
 ownership?:string;ownerTeamKey?:string;waiverDate?:string;percentOwned?:number;
 recentActual?:{date:string;totals:Totals};
 draftAnalysis:Record<string,number>;actual?:{coverage:string;season?:number;week?:number;date?:string;totals:Totals};
};
const flag=(v:unknown)=>v===1||v==='1'?true:v===0||v==='0'?false:undefined;
export function parsePlayerPage(payload:unknown,statMap:Record<string,Category>,asOf:string){
 const container=one(payload,'players');
 const values=collection(container,'player');
 const facts:Record<string,YahooPlayerFacts>={};
 const players=values.map(value=>{
  const p=fields(value),id=key(p.player_key,'player key');
  if(facts[id])throw new YahooSeasonError('Duplicate player in page');
  const player=parseRoster({roster:{players:{count:1,0:{player:value}}}}).players[0];
  const ownership=fields(p.ownership),owned=fields(p.percent_owned),analysis=fields(p.draft_analysis),stats=fields(p.player_stats);
  const draftAnalysis:Record<string,number>={};
  for(const [k,v] of Object.entries(analysis))if(/^(?:preseason_)?(?:average_pick|average_round|percent_drafted)$/.test(k)){
   const n=numeric(v);if(n!==undefined)draftAnalysis[k]=n;
  }
  let actual:YahooPlayerFacts['actual'];
  if(p.player_stats!==undefined){
   const coverage=text(stats.coverage_type);if(!coverage)throw new YahooSeasonError('Missing actual-stat coverage');
   const totals:Totals={};
   for(const v of collection(stats.stats,'stat')){const s=fields(v),c=statMap[String(s.stat_id)],n=numeric(s.value);if(c&&n!==undefined){if(c==='SV%'&&n>1)throw new YahooSeasonError('Invalid save ratio');totals[c]=n;}}
   actual={coverage,season:numeric(stats.season),week:numeric(stats.week),date:text(stats.date),totals};
  }
  facts[id]={source:'Yahoo Fantasy',asOf,displayPosition:text(p.display_position),status:text(p.status),statusFull:text(p.status_full),
   selectedPosition:text(fields(p.selected_position).position),hasPlayerNotes:flag(p.has_player_notes),hasRecentPlayerNotes:flag(p.has_recent_player_notes),
   notesTimestamp:typeof p.player_notes_last_timestamp==='number'?p.player_notes_last_timestamp:text(p.player_notes_last_timestamp),
   ownership:text(ownership.ownership_type),ownerTeamKey:text(ownership.owner_team_key),waiverDate:text(ownership.waiver_date),
   percentOwned:numeric(owned.value),draftAnalysis,actual};
  return player;
 });
 return {players,facts};
}
const out='metadata,ownership,percent_owned,draft_analysis,stats';
/** A full page is never proof of completeness. Explicit terminal page required.
 * Sequential pagination avoids hammering Yahoo; duplicates fail a changing/inconsistent pool.
 */
export async function readAvailable(get:YahooGet,league:string,statMap:Record<string,Category>,asOf:string,pageSize=25){
 key(league,'league key');const players:SeasonPlayer[]=[],facts:Record<string,YahooPlayerFacts>={};
 for(let start=0;start<10000;start+=pageSize){
  const page=parsePlayerPage(await get(`league/${league}/players;status=A;start=${start};count=${pageSize};out=${out}`),statMap,asOf);
  if(page.players.length>pageSize)throw new YahooSeasonError('Oversized available-player page');
  for(const p of page.players){if(facts[p.id])throw new YahooSeasonError('Available-player pagination repeated an identity');players.push(p);facts[p.id]=page.facts[p.id];}
  if(page.players.length<pageSize)return {players,facts};
 }
 throw new YahooSeasonError('Available-player pagination exceeded safety limit; pool incomplete');
}
export async function readYahooLive(get:YahooGet,asOf=new Date().toISOString(),statsDate?:string){
 if(statsDate&&!validDate(statsDate))throw new YahooSeasonError('Invalid actual-stat date');
 const warnings:string[]=[];
 const base=await readYahooSeason(get,2026,asOf);
 const available=await readAvailable(get,base.league.key,base.statMap,asOf);
 const roster=[...(base.snapshot.myTeam?.roster??[]),...(base.snapshot.opponent?.roster??[])];
 const facts={...available.facts};
 for(let i=0;i<roster.length;i+=25){
  const ids=roster.slice(i,i+25).map(p=>p.id);
  const page=parsePlayerPage(await get(`league/${base.league.key}/players;player_keys=${ids.join(',')};out=${out}`),base.statMap,asOf);
  if(page.players.length!==ids.length||page.players.some(p=>!ids.includes(p.id)))throw new YahooSeasonError('Incomplete roster metadata');
  if(statsDate){
   try{
    const daily=one(await get(`league/${base.league.key}/players;player_keys=${ids.join(',')}/stats;type=date;date=${statsDate}`),'players');
    const entries=collection(daily,'player');
    if(entries.length!==ids.length)throw new YahooSeasonError('Incomplete daily stats');
    const seen=new Set<string>();
    for(const entry of entries){const p=fields(entry),id=key(p.player_key,'player key'),s=fields(p.player_stats);
     if(!ids.includes(id)||seen.has(id)||s.coverage_type!=='date'||s.date!==statsDate)throw new YahooSeasonError('Daily stat coverage mismatch');
     seen.add(id);const totals:Totals={};
     for(const v of collection(s.stats,'stat')){const stat=fields(v),c=base.statMap[String(stat.stat_id)],n=numeric(stat.value);if(c&&n!==undefined&&!(c==='SV%'&&n>1))totals[c]=n;}
     page.facts[id].recentActual={date:statsDate,totals};
    }
   }catch{for(const id of ids)delete page.facts[id].recentActual;warnings.push(`Actual player date stats unavailable for roster batch ${i/25+1}; season actuals retained.`);}
  }
  for(const p of page.players){if(facts[p.id])throw new YahooSeasonError('Roster/availability changed during refresh; retry');facts[p.id]={...page.facts[p.id],selectedPosition:base.rosterDetails.mine[p.id]?.selectedPosition??base.rosterDetails.opponent?.[p.id]?.selectedPosition};}
 }
 // Hockey date stats are optional diagnostics, never per-game projections.
 return {...base,facts,warnings,snapshot:{...base.snapshot,freeAgents:available.players},availableCount:available.players.length};
}
