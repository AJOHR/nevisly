import type { DraftPick, SyncMetadata } from '@/types/draft';
import type { SkaterProjection } from '@/types/player';
export type ProjectionSourceState = {id:string; name:string; weight:number; fileName:string; players:SkaterProjection[]};
export type Session = {sync?:SyncMetadata;version:1; id:string; projectionSources:ProjectionSourceState[]; draftPicks:DraftPick[]; leagueTeams:number; myDraftSlot:number};
export const DEFAULT_SESSION:Session = {version:1,id:'manual',projectionSources:[{id:'source-1',name:'Primary Projection',weight:100,fileName:'',players:[]}],draftPicks:[],leagueTeams:12,myDraftSlot:1};
export const SESSION_KEY='nevisly.session.v1';
const record=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
export function parseSession(raw:string):Session {
 const x:unknown=JSON.parse(raw);
 if(!record(x)||x.version!==1||typeof x.id!=='string'||!Number.isInteger(x.leagueTeams)||!Number.isInteger(x.myDraftSlot)||Number(x.leagueTeams)<2||Number(x.leagueTeams)>32||Number(x.myDraftSlot)<1||Number(x.myDraftSlot)>Number(x.leagueTeams)||!Array.isArray(x.draftPicks)||!Array.isArray(x.projectionSources))throw new Error('Invalid saved session');
 const picks=new Set<number>();const players=new Set<string>();
 for(const p of x.draftPicks){if(!record(p)||typeof p.playerId!=='string'||!p.playerId||typeof p.fantasyTeamId!=='string'||!/^team-[1-9]\d*$/.test(p.fantasyTeamId)||Number(p.fantasyTeamId.slice(5))>Number(x.leagueTeams)||!Number.isSafeInteger(p.pickNumber)||Number(p.pickNumber)<1||picks.has(Number(p.pickNumber))||players.has(p.playerId))throw new Error('Invalid saved picks');picks.add(Number(p.pickNumber));players.add(p.playerId);}
 const numeric=['age','gp','goals','assists','points','ppp','sog','hits','blocks'];
 for(const s of x.projectionSources){if(!record(s)||typeof s.id!=='string'||typeof s.name!=='string'||typeof s.fileName!=='string'||typeof s.weight!=='number'||!Number.isFinite(s.weight)||s.weight<0||!Array.isArray(s.players))throw new Error('Invalid saved projections');for(const p of s.players){if(!record(p)||typeof p.id!=='string'||typeof p.name!=='string'||typeof p.team!=='string'||!Array.isArray(p.positions)||!p.positions.every(v=>typeof v==='string')||!numeric.every(k=>typeof p[k]==='number'&&Number.isFinite(p[k])))throw new Error('Invalid saved player');}}
 if(x.sync!==undefined){const m=x.sync;if(!record(m)||!['LIVE','PARTIAL','ERROR'].includes(String(m.status))||typeof m.message!=='string'||!Number.isSafeInteger(m.lastSnapshotSequence)||typeof m.lastReceivedAt!=='number'||!Number.isFinite(m.lastReceivedAt)||!record(m.pickSequences)||!Object.values(m.pickSequences).every(v=>Number.isSafeInteger(v)&&Number(v)>=0)||(m.draftSessionId!==undefined&&typeof m.draftSessionId!=='string')||(m.lastSnapshotAt!==undefined&&(typeof m.lastSnapshotAt!=='number'||!Number.isFinite(m.lastSnapshotAt))))throw new Error('Invalid saved sync state');}
 return x as Session;
}
export type LocalStorageLike=Pick<Storage,'getItem'|'setItem'>;
/** Atomic single-key writes. A stale tab cannot silently overwrite a newer session. */
export function createSessionStore(storage:LocalStorageLike) {
 let raw:string|null=null;let blocked=false;let unavailable=false;let snapshot:{data:Session;warning:string}={data:DEFAULT_SESSION,warning:''};const listeners=new Set<()=>void>();
 try{raw=storage.getItem(SESSION_KEY);}catch{unavailable=true;snapshot={data:DEFAULT_SESSION,warning:'Browser storage is unavailable. Drafting works in memory; export before closing this page.'};}
 if(raw)try{snapshot={data:parseSession(raw),warning:''};}catch{blocked=true;snapshot={data:DEFAULT_SESSION,warning:'Saved draft could not be read. It has not been overwritten. Export it, then explicitly start a new draft.'};}
 const notify=()=>listeners.forEach(f=>f());
 return {recover:()=>{blocked=false;try{raw=storage.getItem(SESSION_KEY);}catch{unavailable=true;}},getSnapshot:()=>snapshot,subscribe:(f:()=>void)=>{listeners.add(f);return ()=>{listeners.delete(f);};},
 update:(change:(s:Session)=>Session)=>{
  if(unavailable){snapshot={data:change(snapshot.data),warning:'Browser storage is unavailable. Drafting works in memory; export before closing this page.'};notify();return;}
  try{if(blocked||storage.getItem(SESSION_KEY)!==raw){snapshot={...snapshot,warning:'Saved draft changed or is unreadable. Reload to recover it; this tab will not overwrite it.'};notify();return;}}catch{snapshot={...snapshot,warning:'Browser storage is unavailable. This session cannot be saved.'};notify();return;}
  const data=change(snapshot.data);const next=JSON.stringify(data);
  try{storage.setItem(SESSION_KEY,next);raw=next;snapshot={data,warning:''};}catch{snapshot={data,warning:'Draft is in memory only: browser storage is full or unavailable. Keep this page open and export your draft.'};}
  notify();
 }};
}
