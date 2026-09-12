import type { Session } from '@/lib/session/session';
import type { DraftPick, SyncMetadata } from '@/types/draft';
import { getSnakeTeamIdForPick, nextPickNumber } from './state';
import { normalizePlayerName } from '@/lib/projections/identity';

type Candidate={id:string;name:string;team:string;positions:string[]};
type YahooPick={pickNumber:number;playerName:string;nhlTeam:string;positions:string[];yahooPlayerId?:string;fantasyTeamId?:string};
const object=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const integer=(x:unknown):x is number=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=0;
export function normalizeNhlTeam(value:string){const key=value.trim().toUpperCase();const aliases:Record<string,string>={TB:'TBL',LA:'LAK',NJ:'NJD',SJ:'SJS',WAS:'WSH',CLB:'CBJ',MON:'MTL'};return aliases[key]??key;}
function readPick(value:unknown,teams:number):YahooPick {
 if(!object(value)||!integer(value.pickNumber)||value.pickNumber<1||value.pickNumber>10000||typeof value.playerName!=='string'||!value.playerName.trim()||typeof value.nhlTeam!=='string')throw Error('Invalid Yahoo pick');
 if(value.positions!==undefined&&(!Array.isArray(value.positions)||!value.positions.every(p=>typeof p==='string'&&['C','LW','RW','D','G'].includes(p))))throw Error('Invalid Yahoo eligibility');
 if(value.yahooPlayerId!==undefined&&(typeof value.yahooPlayerId!=='string'||!value.yahooPlayerId))throw Error('Invalid Yahoo player ID');
 if(value.fantasyTeamId!==undefined&&(typeof value.fantasyTeamId!=='string'||!/^team-[1-9]\d*$/.test(value.fantasyTeamId)||Number(value.fantasyTeamId.slice(5))>teams))throw Error('Invalid Yahoo owner');
 return {pickNumber:value.pickNumber,playerName:value.playerName.trim(),nhlTeam:value.nhlTeam,positions:(value.positions??[]) as string[],yahooPlayerId:value.yahooPlayerId as string|undefined,fantasyTeamId:value.fantasyTeamId as string|undefined};
}
export function matchYahooPlayer(pick:Pick<YahooPick,'playerName'|'nhlTeam'>,players:Candidate[]):{player?:Candidate;ambiguous:boolean} {
 const exact=players.filter(p=>normalizePlayerName(p.name)===normalizePlayerName(pick.playerName));
 if(exact.length===1)return {player:exact[0],ambiguous:false}; // Unique full identity survives a trade.
 if(exact.length>1){const team=exact.filter(p=>normalizeNhlTeam(p.team)===normalizeNhlTeam(pick.nhlTeam));return team.length===1?{player:team[0],ambiguous:false}:{ambiguous:true};}
 const parts=pick.playerName.trim().split(/\s+/);const first=parts[0].replace('.','');
 // Fuzzy initials are only allowed when Yahoo actually supplied an initial, never a different full name.
 if(first.length!==1||parts.length<2)return {ambiguous:false};
 const last=normalizePlayerName(parts.slice(1).join(' '));
 const matches=players.filter(p=>{const n=p.name.trim().split(/\s+/);return normalizePlayerName(n[0])[0]===normalizePlayerName(first)&&normalizePlayerName(n.slice(1).join(' '))===last&&normalizeNhlTeam(p.team)===normalizeNhlTeam(pick.nhlTeam);});
 return matches.length===1?{player:matches[0],ambiguous:false}:{ambiguous:matches.length>1};
}
function resolve(p:YahooPick,players:Candidate[],teams:number,previous:DraftPick[]):DraftPick {
 const old=previous.find(x=>x.pickNumber===p.pickNumber);
 const mapped=old?.manualProjectionId && ((p.yahooPlayerId && p.yahooPlayerId===old.yahooPlayerId) || normalizePlayerName(p.playerName)===normalizePlayerName(old.playerName??"")) ? players.find(x=>x.id===old.manualProjectionId) : undefined;
 const match=mapped?{player:mapped,ambiguous:false}:p.positions.includes('G')?{ambiguous:false}:matchYahooPlayer(p,players);
 return {manualProjectionId:mapped?.id,playerId:match.player?.id??`yahoo:${p.yahooPlayerId??`pick-${p.pickNumber}`}`,pickNumber:p.pickNumber,fantasyTeamId:p.fantasyTeamId??getSnakeTeamIdForPick(p.pickNumber,teams),playerName:p.playerName,nhlTeam:normalizeNhlTeam(p.nhlTeam),positions:p.positions,yahooPlayerId:p.yahooPlayerId,source:'yahoo',resolution:p.positions.includes('G')?'goalie':match.player?'matched':match.ambiguous?'ambiguous':'unresolved'};
}
const emptySync:SyncMetadata={lastSnapshotSequence:-1,pickSequences:{},status:'PARTIAL',message:'Waiting for a validated snapshot',lastReceivedAt:0};
/** Versioned snapshots establish a sequence barrier. Legacy snapshots only merge non-conflicting picks. */
export function applyYahooMessage(session:Session,raw:unknown,kind:'pick'|'snapshot',players:Candidate[],now=Date.now()):Session {
 const prior=session.sync??emptySync;
 const fail=(message:string):Session=>({...session,sync:{...prior,status:'ERROR',message,lastReceivedAt:now}});
 try{
  const data:unknown=typeof raw==='string'?JSON.parse(raw):raw;
  const versioned=object(data)&&data.schemaVersion!==undefined;
  let sequence:number|undefined;let draftSessionId=prior.draftSessionId;let allowRollback=false;
  if(versioned){
   if(data.schemaVersion!==1||typeof data.draftSessionId!=='string'||!data.draftSessionId||!integer(data.sequence)||data.kind!==kind)throw Error('Invalid bridge envelope');
   if(prior.draftSessionId&&prior.draftSessionId!==data.draftSessionId)throw Error('Different Yahoo draft session. Start a new draft explicitly before connecting it.');
   if(kind==='snapshot'&&data.complete!==true)throw Error('Snapshot is incomplete; request a complete snapshot');
   if(data.allowRollback!==undefined&&typeof data.allowRollback!=='boolean')throw Error('Invalid correction flag');
   sequence=data.sequence;draftSessionId=data.draftSessionId;allowRollback=data.allowRollback===true;
   if(sequence<=prior.lastSnapshotSequence)return session;
  }else if(prior.draftSessionId){return fail('Legacy event ignored after versioned synchronization; request a versioned snapshot');}
  const values=kind==='snapshot'?(versioned?data.picks:data):[versioned?data.pick:data];
  if(!Array.isArray(values)||values.length>10000)throw Error('Invalid snapshot');
  const incoming=values.map(v=>resolve(readPick(v,session.leagueTeams),players,session.leagueTeams,session.draftPicks)).sort((a,b)=>a.pickNumber-b.pickNumber);
  if(new Set(incoming.map(p=>p.pickNumber)).size!==incoming.length||new Set(incoming.map(p=>p.playerId)).size!==incoming.length)throw Error('Duplicate pick number or player in Yahoo snapshot');
  if(versioned&&kind==='snapshot'&&incoming.some((p,i)=>p.pickNumber!==i+1))throw Error('Complete snapshot has gaps');
  let result=[...session.draftPicks];const revisions={...prior.pickSequences};let conflicts=0;
  if(versioned&&kind==='snapshot'){
   const high=nextPickNumber(incoming)-1;
   result=result.filter(p=>{
    if((revisions[p.pickNumber]??-1)>sequence!)return true; // Preserve live events newer than this snapshot.
    if(p.pickNumber<=high)return false; // Authoritative corrections inside covered history.
    return !allowRollback; // Short snapshots are not implicit undo commands.
   });
  }
  for(const pick of incoming){
   if(sequence!==undefined&&(revisions[pick.pickNumber]??-1)>=sequence)continue;
   const existing=result.find(p=>p.pickNumber===pick.pickNumber);
   if(sequence===undefined&&existing){
    if(existing.playerId!==pick.playerId||existing.fantasyTeamId!==pick.fantasyTeamId){conflicts++;continue;}
   }
   if(result.some(p=>p.pickNumber!==pick.pickNumber&&p.playerId===pick.playerId)){conflicts++;continue;}
   result=[...result.filter(p=>p.pickNumber!==pick.pickNumber),pick];
   if(sequence!==undefined)revisions[pick.pickNumber]=sequence;
  }
  if(conflicts&&versioned)return fail('Conflicting player ownership; snapshot was not applied');
  result.sort((a,b)=>a.pickNumber-b.pickNumber);
  const unresolved=result.filter(p=>p.resolution==='unresolved'||p.resolution==='ambiguous').length;
  const gaps=nextPickNumber(result)-1-result.length;
  const suffixRetained=versioned&&kind==='snapshot'&&!allowRollback&&result.some(p=>p.pickNumber>incoming.length&&(prior.pickSequences[p.pickNumber]??-1)<=sequence!);
  const complete=versioned&&kind==='snapshot'&&!gaps&&!conflicts&&!suffixRetained;
  return {...session,draftPicks:result,sync:{...prior,draftSessionId,pickSequences:revisions,lastSnapshotSequence:versioned&&kind==='snapshot'?sequence!:prior.lastSnapshotSequence,lastSnapshotAt:complete?now:prior.lastSnapshotAt,lastReceivedAt:now,status:unresolved||conflicts||gaps||suffixRetained||!versioned?'PARTIAL':complete||prior.status==='LIVE'?'LIVE':'PARTIAL',message:conflicts?`${conflicts} conflicts retained; request a versioned snapshot`:unresolved?`${unresolved} selections need projection matching`:suffixRetained?'Short snapshot retained later picks; explicit correction required':gaps?`${gaps} missing selections; request a snapshot`:versioned?'Validated Yahoo data':'Legacy bridge: freshness cannot be verified'}};
 }catch(error){return fail(error instanceof Error?error.message:'Invalid Yahoo data');}
}
