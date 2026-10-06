'use client';
import {useMemo,useState} from 'react';
import {useDraftSession} from '@/hooks/useDraftSession';
import {blendSkaterProjections} from '@/lib/projections/blendSkaterProjections';
import {composeLiveSeason,type LiveSeasonData} from '@/lib/season/live';
import SeasonMode from './SeasonMode';
export default function LiveSeasonMode(){
 const [mode,setMode]=useState<'live'|'manual'>('live'),[timeZone,setTimeZone]=useState(''),[data,setData]=useState<LiveSeasonData|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const {data:session}=useDraftSession();
 const projections=useMemo(()=>blendSkaterProjections(session.projectionSources),[session.projectionSources]);
 const joined=useMemo(()=>data?composeLiveSeason(data,projections):null,[data,projections]);
 async function refresh(){
  setBusy(true);setError('');setData(null);
  try{const response=await fetch(`/api/yahoo/season/live?timeZone=${encodeURIComponent(timeZone)}`,{cache:'no-store'});const result=await response.json();if(!response.ok||!result.success)throw Error(result.error??'Live refresh failed');setData(result);}
  catch(e){setError(e instanceof Error?e.message:'Live refresh failed');}finally{setBusy(false);}
 }
 const players=data?[...(data.snapshot.myTeam?.roster??[]),...(data.snapshot.opponent?.roster??[]),...(data.snapshot.freeAgents??[])]:[];
 return <>
  <section className="m-4 space-y-3 rounded-xl border border-zinc-700 bg-zinc-900 p-4 text-sm">
   <div className="flex flex-wrap items-center gap-3"><label>League data <select aria-label="Season data source" className="ml-2 bg-zinc-800 p-2" value={mode} onChange={e=>setMode(e.target.value as 'live'|'manual')}><option value="live">Yahoo · Read only</option><option value="manual">Manual/mock fixture</option></select></label>
    {mode==='live'&&<><label>League calendar timezone <input aria-label="League calendar timezone" placeholder="e.g. America/New_York" className="ml-2 bg-zinc-800 p-2" value={timeZone} onChange={e=>{setTimeZone(e.target.value);setData(null);}} disabled={busy}/></label><button className="rounded bg-emerald-400 px-3 py-2 text-black disabled:opacity-50" disabled={busy||!timeZone} onClick={refresh}>{busy?'Loading Yahoo + NHL…':'Load / refresh live state'}</button></>}
   </div>
   {mode==='live'&&<><p>Confirm your league calendar timezone. Refresh is manual; Yahoo is read-only. Uses the projections already uploaded in Draft; their weights are unchanged. Today is included; intraday locks and completed games today are not modeled.</p>
    {error&&<p role="alert" className="text-amber-300">{error} No fixture fallback.</p>}
    {!data&&!busy&&!error&&<p>Live data not loaded. Authenticate on this host, then load. Manual data is available only by explicit selection.</p>}
    {data&&joined&&<><p>{data.league.name} · {data.snapshot.myTeam?.name} vs {data.snapshot.opponent?.name??'Opponent unknown'} · Yahoo {data.snapshot.source?.asOf} · NHL cache: 6 hours</p>
     <p>Projection coverage: {joined.coverage.matched}/{joined.coverage.skaters} skaters. Available pool: {data.availableCount}. Unknown schedules: {joined.coverage.missingSchedule.length}. ROS displayed below is the uploaded projection Player Value proxy, not a current ROS reforecast.</p>
     {joined.issues.map(i=><p key={i} className="text-amber-300">{i}</p>)}
     <details><summary>Source coverage / player facts</summary><p>Unmatched projections: {joined.coverage.unmatched.join(', ')||'None'}</p><p>Unknown schedules: {joined.coverage.missingSchedule.join(', ')||'None'}</p><p>Yahoo statuses are warnings, not predicted missed games. Actual stats and ADP do not enter projections or weekly fit.</p>
      <div className="max-h-96 overflow-auto"><table className="w-full text-left"><thead><tr>{['Player','Ownership','Status / slot','% owned','Live ADP','Actual / notes'].map(c=><th key={c} className="p-2">{c}</th>)}</tr></thead><tbody>{players.map(p=>{const f=data.facts[p.id];return <tr key={p.id}><td className="p-2">{p.name}</td><td>{f?.ownership??'Unknown'}</td><td>{[f?.status,f?.statusFull,f?.selectedPosition].filter(Boolean).join(' / ')||'—'}</td><td>{f?.percentOwned??'—'}</td><td>{f?.draftAnalysis.average_pick??'Unknown'}</td><td><details><summary>Yahoo facts</summary><pre className="whitespace-pre-wrap">{JSON.stringify({actual:f?.actual,recentActual:f?.recentActual,draftAnalysis:f?.draftAnalysis,notes:f?.hasPlayerNotes,recentNotes:f?.hasRecentPlayerNotes,notesTimestamp:f?.notesTimestamp,asOf:f?.asOf},null,2)}</pre></details></td></tr>;})}</tbody></table></div>
     </details>
     {!joined.composition.available&&<p className="text-amber-300">Insufficient live inputs: {[...joined.composition.missing,...joined.composition.errors].join(', ')}</p>}
    </>}
   </>}
  </section>
  {mode==='manual'?<SeasonMode/>:joined?.composition.available?<SeasonMode state={joined.composition.state}/>:null}
 </>;
}
