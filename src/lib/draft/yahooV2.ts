import type { Session } from '@/lib/session/session';
import { linkYahooSelection, detachProjectionCollisions } from './yahoo';
import type { SkaterProjection } from '@/types/player';

type Row={pickNumber:number;round:number|null;playerName:string;yahooPlayerId?:string;nhlTeam:string;positions:string[];ownerName:string};
export type Capture={rows:Row[];issues:string[];coverage:'partial'|'complete';currentPick:number|null;round:number|null;teamCount:number|null};
export type Observation={schemaVersion:2;type:'observation';destinationSessionId:string;roomPath:string;stream:string;sequence:number;capture:Capture;capturedAt:number};
export type Offer={schemaVersion:2;type:'offer';sourceTab:string;roomPath:string;stream:string;capture:Capture;capturedAt:number};
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const ordinal=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0&&v<=10000;
const nullableOrdinal=(v:unknown)=>v===null||ordinal(v);
export function validCapture(v:unknown):v is Capture {
  return record(v)&&Array.isArray(v.rows)&&v.rows.length<=10000&&v.rows.every(p=>record(p)&&ordinal(p.pickNumber)&&nullableOrdinal(p.round)&&typeof p.playerName==='string'&&p.playerName.length<300&&typeof p.nhlTeam==='string'&&p.nhlTeam.length<100&&typeof p.ownerName==='string'&&p.ownerName.length<300&&(p.yahooPlayerId===undefined||(typeof p.yahooPlayerId==='string'&&/^\d+$/.test(p.yahooPlayerId)))&&Array.isArray(p.positions)&&p.positions.every(x=>typeof x==='string'&&['C','LW','RW','D','G'].includes(x)))&&Array.isArray(v.issues)&&v.issues.length<=10000&&v.issues.every(x=>typeof x==='string')&&['partial','complete'].includes(String(v.coverage))&&nullableOrdinal(v.currentPick)&&nullableOrdinal(v.round)&&nullableOrdinal(v.teamCount);
}
export function validOffer(v:unknown):v is Offer {
  return record(v)&&v.schemaVersion===2&&v.type==='offer'&&typeof v.sourceTab==='string'&&/^\d+$/.test(v.sourceTab)&&typeof v.roomPath==='string'&&/^\/draft\/hockey\/\d+\/\d+\/?$/.test(v.roomPath)&&typeof v.stream==='string'&&v.stream.length>0&&v.stream.length<150&&typeof v.capturedAt==='number'&&Number.isFinite(v.capturedAt)&&validCapture(v.capture);
}
export function bindYahooBridge(session:Session,offer:Offer):Session {
  if(!validOffer(offer))throw Error('Invalid Yahoo offer');
  if(offer.capture.teamCount && offer.capture.teamCount!==session.leagueTeams)throw Error(`Yahoo history indicates ${offer.capture.teamCount} teams; Nevisly is configured for ${session.leagueTeams}.`);
  return {...session,bridge:{roomPath:offer.roomPath,stream:offer.stream,sequence:-1,fingerprint:'',lastReceivedAt:0,capturedAt:0,extraction:'unsupported',coverage:'unverified',issues:[],ownerSlots:{}}};
}
/** Correction authority is a local user action, never a Boolean trusted from the wire. */
export function receiveYahooV2(session:Session,raw:unknown,players:SkaterProjection[],now=Date.now(),approveCorrection=false):{session:Session;status:'applied'|'replayed'|'rejected';reason?:string} {
  const bound=session.bridge;
  const reject=(reason:string)=>({session,status:'rejected' as const,reason});
  if(!bound||!record(raw)||raw.schemaVersion!==2||raw.type!=='observation'||raw.destinationSessionId!==session.id||raw.roomPath!==bound.roomPath||raw.stream!==bound.stream)return reject('Unbound or different Yahoo session');
  if(!ordinal(raw.sequence)||typeof raw.capturedAt!=='number'||!Number.isFinite(raw.capturedAt)||raw.capturedAt>now+60000||!validCapture(raw.capture))return reject('Invalid observation');
  const frame=raw as Observation, c=frame.capture, fp=JSON.stringify(c);
  if(frame.sequence<bound.sequence)return reject('Older observation ignored');
  if(frame.sequence===bound.sequence && fp!==bound.fingerprint)return reject('Contradictory content at the same observation sequence');
  if(approveCorrection && (bound.pendingFrame!==JSON.stringify(frame)||frame.sequence!==bound.sequence))return reject('Correction must refer to the latest pending observation');
  if(frame.sequence===bound.sequence&&!approveCorrection)return {session:{...session,bridge:{...bound,lastReceivedAt:now,capturedAt:Math.max(bound.capturedAt,frame.capturedAt)}},status:'replayed'};
  const numbers=new Set(c.rows.map(p=>p.pickNumber));
  if(numbers.size!==c.rows.length)return reject('Duplicate overall pick number');
  if(c.teamCount!==null&&c.teamCount!==session.leagueTeams)return reject('Yahoo/Nevisly league-size mismatch');
  const rows=[...c.rows].sort((a,b)=>a.pickNumber-b.pickNumber);
  const allCovered=rows.every((p,i)=>p.pickNumber===i+1);
  const complete=c.coverage==='complete'&&c.issues.length===0&&c.teamCount===session.leagueTeams&&c.currentPick===rows.length+1&&allCovered&&c.round===Math.floor(((c.currentPick??1)-1)/session.leagueTeams)+1&&rows.every(p=>p.round===Math.floor((p.pickNumber-1)/session.leagueTeams)+1);
  if(c.coverage==='complete'&&!complete)return reject('Complete snapshot failed independent header/round coverage checks');
  if(approveCorrection&&!complete)return reject('Partial observations cannot authorize correction/removal');
  const ownerSlots:Record<string,number>=Object.assign(Object.create(null),bound.ownerSlots);
  const firstRound=rows.filter(p=>p.round===1&&p.pickNumber<=session.leagueTeams);
  for(const p of firstRound)if(p.ownerName){
    const same=firstRound.filter(x=>x.ownerName===p.ownerName);
    if(same.length===1)ownerSlots[p.ownerName]=p.pickNumber;else delete ownerSlots[p.ownerName];
  }
  const issues=[...c.issues];let conflict=false;
  let result=approveCorrection?[]:[...session.draftPicks];
  const ids=c.rows.flatMap(p=>p.yahooPlayerId?[p.yahooPlayerId]:[]),duplicates=new Set(ids.filter((id,i)=>ids.indexOf(id)!==i));
  for(const p of rows){
    const old=session.draftPicks.find(x=>x.pickNumber===p.pickNumber);
    const slot=ownerSlots[p.ownerName];const owner=slot?`team-${slot}`:'unassigned';
    const projected=linkYahooSelection(session,p,players);
    const changed=old&&((old.source!=='yahoo'&&old.projectionId&&projected.projectionId&&old.projectionId!==projected.projectionId)||(old.yahooPlayerId&&p.yahooPlayerId&&old.yahooPlayerId!==p.yahooPlayerId)||(old.ownerName&&p.ownerName&&old.ownerName!==p.ownerName&&old.fantasyTeamId!==owner)||(!old.yahooPlayerId&&old.playerName&&p.playerName&&old.playerName!==p.playerName));
    if(changed&&!approveCorrection){conflict=true;issues.push(`Pick #${p.pickNumber} differs from retained history`);continue;}
    const observation={...p,yahooPlayerId:duplicates.has(p.yahooPlayerId??'')?undefined:p.yahooPlayerId};
    const linked=linkYahooSelection(session,observation,players);
    if(duplicates.has(p.yahooPlayerId??'')){linked.projectionId=undefined;linked.playerId=linked.selectionId!;linked.resolution='ambiguous';issues.push(`Conflicting Yahoo player identity at #${p.pickNumber}`);}
    const selection={...linked,ownerName:p.ownerName||old?.ownerName,fantasyTeamId:slot?owner:old?.fantasyTeamId??'unassigned',ownershipSource:slot?'history-derived' as const:old?.ownershipSource??'unassigned' as const};
    result=[...result.filter(x=>x.pickNumber!==p.pickNumber),selection];
  }
  if(complete&&!approveCorrection&&session.draftPicks.some(p=>p.pickNumber>rows.length)){conflict=true;issues.push('Shorter history requires explicit correction; later picks retained');}
  const bridge={...bound,sequence:frame.sequence,fingerprint:fp,lastReceivedAt:now,capturedAt:frame.capturedAt,ownerSlots,extraction:c.rows.length?'partial' as const:'unsupported' as const,coverage:'partial' as const,issues,pendingFrame:undefined as string|undefined};
  if(conflict)return {session:{...session,bridge:{...bridge,coverage:'conflict',pendingFrame:JSON.stringify(frame)}},status:'rejected',reason:'History correction requires review'};
  result=detachProjectionCollisions(result).sort((a,b)=>a.pickNumber-b.pickNumber);
  if(rows.some(p=>!result.some(r=>r.pickNumber===p.pickNumber)))return reject('Final represented coverage failed');
  const finalComplete=complete&&result.length===rows.length&&result.every((p,i)=>p.pickNumber===i+1)&&!issues.length;
  return {session:{...session,draftPicks:result,bridge:{...bridge,extraction:!rows.length?'unsupported':issues.length?'partial':'ok',coverage:finalComplete?'complete-through-header':'partial'}},status:'applied'};
}

/** Verified Yahoo eligibility overrides provider eligibility; score coefficients are unchanged. */
export function applyYahooEligibility<T extends SkaterProjection>(players:T[],picks:Session['draftPicks']):T[] {
  return players.map(player=>{
    const pick=picks.find(p=>p.source==='yahoo'&&p.projectionId===player.id&&p.positions?.length);
    return pick?{...player,positions:[...pick.positions!]}:player;
  });
}
