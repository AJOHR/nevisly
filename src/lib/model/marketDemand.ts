import { normalizePlayerName } from '@/lib/projections/identity';
import type { DraftPick } from '@/types/draft';
import * as bundled from './yahoo-adp.json';

export type MarketPlayer = {yahooPlayerId:string; name:string; team:string; positions:string[]; adp:number};
export type MarketSnapshot = {source:string; sourceUrl:string; sourceDate:string; retrievedAt:string; scoringContext:string; season:string; players:MarketPlayer[]};
export const defaultMarketSnapshot:MarketSnapshot = bundled;
export const marketStorageKey='nevisly.yahoo-adp.v1';

/** Separate from projections: explicit Yahoo provenance, no guessed ADP or ambiguous IDs. */
export function parseMarketSnapshot(value:unknown):MarketSnapshot {
  const s=value as MarketSnapshot;
  if(!s || s.source!==bundled.source || s.sourceUrl!==bundled.sourceUrl || s.scoringContext!==bundled.scoringContext ||
    s.season!==bundled.season || !/^\d{4}-\d{2}-\d{2}$/.test(s.sourceDate) || !Number.isFinite(Date.parse(s.retrievedAt)) ||
    !Array.isArray(s.players) || !s.players.length || s.players.length>5000)throw Error('Invalid Yahoo ADP snapshot or season.');
  const ids=new Set<string>();
  for(const p of s.players) {
    if(!p || typeof p.yahooPlayerId!=='string' || !/^\d+$/.test(p.yahooPlayerId) || ids.has(p.yahooPlayerId) ||
      typeof p.name!=='string' || !p.name.trim() || typeof p.team!=='string' || !Array.isArray(p.positions) ||
      !p.positions.every(x=>typeof x==='string') || !Number.isFinite(p.adp) || p.adp<=0)throw Error('Invalid or duplicate Yahoo ADP player.');
    ids.add(p.yahooPlayerId);
  }
  return s;
}

const nameKey=(name:string)=>normalizePlayerName(name.replace(/\s+(?:jr\.?|sr\.?|ii|iii|iv)\s*$/i,''));
type Identity={id:string;name:string};
/** Unique full normalized names only. Team changes cannot break a unique match;
 * duplicate names (including suffix collisions) remain unknown, never guessed. */
export function matchMarketPlayers(players:readonly Identity[],snapshot:MarketSnapshot) {
  const marketNames=new Map<string,MarketPlayer[]>(),projectionNames=new Map<string,Identity[]>();
  for(const p of snapshot.players){const k=nameKey(p.name);marketNames.set(k,[...(marketNames.get(k)??[]),p]);}
  for(const p of players){const k=nameKey(p.name);projectionNames.set(k,[...(projectionNames.get(k)??[]),p]);}
  const matches=new Map<string,MarketPlayer>();
  for(const [key,group] of projectionNames)if(group.length===1&&marketNames.get(key)?.length===1)matches.set(group[0].id,marketNames.get(key)![0]);
  return matches;
}

export function prepareMarketDemand(players:readonly Identity[],picks:readonly DraftPick[],snapshot:MarketSnapshot) {
  const matches=matchMarketPlayers(players,snapshot);
  const projectionByYahoo=new Map([...matches].map(([id,p])=>[p.yahooPlayerId,id]));
  const removed=new Set<string>();
  const selectionMatches=matchMarketPlayers(picks.filter(p=>p.playerName).map((p,i)=>({id:String(i),name:p.playerName!})),snapshot);
  for(const p of selectionMatches.values())removed.add(p.yahooPlayerId);
  for(const p of picks) {
    if(p.yahooPlayerId)removed.add(p.yahooPlayerId.split('.p.').at(-1)!);
    const m=matches.get(p.projectionId??p.playerId);if(m)removed.add(m.yahooPlayerId);
  }
  // Include goalies and unprojected Yahoo players: they consume opponent picks,
  // but never become seven-category future candidates or alter roster valuation.
  const order=snapshot.players.filter(p=>!removed.has(p.yahooPlayerId)).sort((a,b)=>a.adp-b.adp||a.yahooPlayerId.localeCompare(b.yahooPlayerId));
  const ids=order.map(p=>projectionByYahoo.get(p.yahooPlayerId)??`yahoo-market:${p.yahooPlayerId}`);
  const ranks=new Map(ids.map((id,i)=>[id,i+1]));
  return {matches,ids,ranks};
}

export function marketTiming(adp:number|undefined,rank:number|undefined,wait:number,nextPick:number) {
  if(adp===undefined||rank===undefined)return {level:'UNKNOWN' as const,risk:'UNKNOWN' as const,reason:'Yahoo market timing UNKNOWN: no unique ADP match. Not assumed to survive in the next-pick plan.'};
  const level:'LOW'|'HIGH'|'MODERATE'=wait===0?'LOW':rank<=wait?'HIGH':rank<=wait*2?'MODERATE':'LOW';
  return {level,risk:level==='HIGH'?'RISKY' as const:level==='MODERATE'?'POSSIBLE' as const:'SAFE' as const,
    reason:`Yahoo ADP ${adp}; remaining market order #${rank}; next pick ${nextPick} (${wait} opponent selections). ${level==='HIGH'?'Inside modeled removal window':level==='MODERATE'?'Near modeled removal window':'Outside modeled removal window'}; qualitative ordering, not a survival probability.`};
}
