'use client';
import {useMemo,useState} from 'react';
import {useLiveSeason,validTimeZone} from '@/hooks/useLiveSeason';
import {useDraftSession} from '@/hooks/useDraftSession';
import {blendSkaterProjections} from '@/lib/projections/blendSkaterProjections';
import {composeLiveSeason} from '@/lib/season/live';
import SeasonMode from './SeasonMode';
export default function LiveSeasonMode(){
 const [mode,setMode]=useState<'live'|'manual'>('live');
 const {data,timeZone,setTimeZone,confirmed,setConfirmed,busy,error,needsAuth,storageWarning,refresh}=useLiveSeason(mode==='live');
 const {data:session}=useDraftSession();
 const projections=useMemo(()=>blendSkaterProjections(session.projectionSources),[session.projectionSources]);
 const joined=useMemo(()=>data&&confirmed?composeLiveSeason(data,projections):null,[data,confirmed,projections]);
 const players=data?[...(data.snapshot.myTeam?.roster??[]),...(data.snapshot.opponent?.roster??[]),...(data.snapshot.freeAgents??[])]:[];
 return <>
  <section className="m-4 space-y-3 rounded-xl border border-zinc-700 bg-zinc-900 p-4 text-sm">
   <div className="flex flex-wrap items-center gap-3"><label>League data <select aria-label="Season data source" className="ml-2 bg-zinc-800 p-2" value={mode} onChange={e=>setMode(e.target.value as 'live'|'manual')}><option value="live">Yahoo · Read only</option><option value="manual">Manual/mock fixture</option></select></label>
    {mode==='live'&&confirmed&&<><span>League calendar: {timeZone}</span><button onClick={()=>setConfirmed(false)} disabled={busy} className="underline">Change timezone</button><button className="rounded bg-emerald-400 px-3 py-2 text-black disabled:opacity-50" disabled={busy} onClick={()=>void refresh(timeZone,data?.league.key)}>Refresh</button></>}
   </div>
   {mode==='live'&&<><p>Yahoo is read-only. Uses your saved Draft projections automatically. Today is included; intraday locks and completed games today are not modeled.</p>
    {busy&&<p role="status">Loading Yahoo + NHL…</p>}
    {needsAuth&&<a className="inline-block rounded bg-emerald-400 px-3 py-2 text-black" href="/api/auth/yahoo" target="_blank" rel="noopener noreferrer">Connect Yahoo</a>}
    {needsAuth&&<p>Complete Yahoo authentication in the new tab, then return here. Live data will load automatically.</p>}
    {error&&<div role="alert" className="text-amber-300">{error}{!needsAuth&&<button className="ml-3 underline" onClick={()=>void refresh(timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone)}>Retry</button>}</div>}
    {storageWarning&&<p role="status" className="text-amber-300">{storageWarning}</p>}
    {data&&!confirmed&&!busy&&<div><p>Confirm the calendar timezone for {data.league.name}. Your browser timezone may differ from your league timezone. Calculations wait for confirmation.</p><label>League calendar timezone <input aria-label="League calendar timezone" className="ml-2 bg-zinc-800 p-2" value={timeZone} onChange={e=>setTimeZone(e.target.value)}/></label><button className="ml-2 rounded bg-emerald-400 px-3 py-2 text-black disabled:opacity-50" disabled={!validTimeZone(timeZone)} onClick={()=>void refresh(timeZone,data?.league.key)}>Confirm timezone</button></div>}
    {!projections.length&&<p className="text-amber-300">Projections missing. Upload projections in Draft; Season will reuse them automatically. Live facts remain available; projection-dependent calculations are unavailable.</p>}
    {data&&Object.entries(data.scheduleErrors??{}).length>0&&<div role="alert" className="text-amber-300">NHL schedule unavailable: {Object.entries(data.scheduleErrors??{}).map(([team,reason])=>`${team}: ${reason}`).join('; ')}<button className="ml-3 underline" disabled={busy} onClick={()=>void refresh(timeZone,confirmed?data.league.key:undefined)}>Retry</button></div>}
    {data&&<><p>{data.league.name} · {data.snapshot.myTeam?.name} vs {data.snapshot.opponent?.name??'Opponent unknown'} · Yahoo {data.snapshot.source?.asOf} · NHL cache: 6 hours</p>
     {joined&&<><p>Projection coverage: {joined.coverage.matched}/{joined.coverage.skaters} skaters. Available pool: {data.availableCount}. Unknown schedules: {joined.coverage.missingSchedule.length}. ROS displayed below is the uploaded projection Player Value proxy, not a current ROS reforecast.</p>
     {joined.issues.map(i=><p key={i} className="text-amber-300">{i}</p>)}</>}
     <details><summary>Source coverage / player facts</summary>{joined&&<><p>Unmatched projections: {joined.coverage.unmatched.join(', ')||'None'}</p><p>Unknown schedules: {joined.coverage.missingSchedule.join(', ')||'None'}</p></>}<p>Yahoo statuses are warnings, not predicted missed games. Actual stats and ADP do not enter projections or weekly fit.</p>
      <div className="max-h-96 overflow-auto"><table className="w-full text-left"><thead><tr>{['Player','Ownership','Status / slot','% owned','Live ADP','Actual / notes'].map(c=><th key={c} className="p-2">{c}</th>)}</tr></thead><tbody>{players.map(p=>{const f=data.facts[p.id];return <tr key={p.id}><td className="p-2">{p.name}</td><td>{f?.ownership??'Unknown'}</td><td>{[f?.status,f?.statusFull,f?.selectedPosition].filter(Boolean).join(' / ')||'—'}</td><td>{f?.percentOwned??'—'}</td><td>{f?.draftAnalysis.average_pick??'Unknown'}</td><td><details><summary>Yahoo facts</summary><pre className="whitespace-pre-wrap">{JSON.stringify({actual:f?.actual,recentActual:f?.recentActual,draftAnalysis:f?.draftAnalysis,notes:f?.hasPlayerNotes,recentNotes:f?.hasRecentPlayerNotes,notesTimestamp:f?.notesTimestamp,asOf:f?.asOf},null,2)}</pre></details></td></tr>;})}</tbody></table></div>
     </details>
     {joined&&!joined.composition.available&&<p className="text-amber-300">Insufficient live inputs: {[...joined.composition.missing,...joined.composition.errors].join(', ')}</p>}
    </>}
   </>}
  </section>
  {mode==='manual'?<SeasonMode/>:joined?.composition.available?<SeasonMode state={joined.composition.state}/>:null}
 </>;
}
