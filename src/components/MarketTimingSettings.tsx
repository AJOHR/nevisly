'use client';
import { useEffect, useState } from 'react';
import { defaultMarketSnapshot, marketStorageKey, parseMarketSnapshot, type MarketSnapshot } from '@/lib/model/marketDemand';

/** ADP cache is independent of projection blending and draft-session ownership. */
export default function MarketTimingSettings({snapshot,onChange}:{snapshot:MarketSnapshot;onChange:(s:MarketSnapshot)=>void}) {
  const [error,setError]=useState('');
  useEffect(()=>{
    let active=true;
    queueMicrotask(()=>{
      if(!active)return;
      try {const stored=localStorage.getItem(marketStorageKey);if(stored)onChange(parseMarketSnapshot(JSON.parse(stored)));}
      catch {setError('Saved Yahoo ADP snapshot unavailable; using bundled data.');}
    });
    return ()=>{active=false;};
  },[onChange]);
  function save(next:MarketSnapshot) {
    onChange(next);
    try {localStorage.setItem(marketStorageKey,JSON.stringify(next));setError('');}
    catch {setError('Snapshot active for this tab only; browser storage unavailable.');}
  }
  return <details className="mb-4 rounded-lg border border-zinc-800 p-3 text-xs text-zinc-400">
    <summary className="cursor-pointer">Yahoo market timing · {snapshot.players.length} ADP entries · retrieved {snapshot.retrievedAt.slice(0,10)}</summary>
    <p className="my-2">Yahoo standard scoring ADP. Opponent demand only—not Player Value or Team Fit. SAFE/POSSIBLE/RISKY describe market-order windows, not probabilities. Unmatched players show UNKNOWN and are not assumed to survive. Actual drafts may differ.</p>
    <a className="underline" href={snapshot.sourceUrl} target="_blank" rel="noreferrer">Yahoo Draft Analysis</a>
    <label className="ml-3">Replace Yahoo snapshot (JSON) <input aria-label="Yahoo ADP snapshot" type="file" accept=".json,application/json" onChange={async e=>{
      const file=e.target.files?.[0];if(!file)return;
      try {if(file.size>2000000)throw Error('Snapshot exceeds 2 MB.');save(parseMarketSnapshot(JSON.parse(await file.text())));}
      catch(err){setError(err instanceof Error?err.message:'Invalid snapshot; existing data retained.');}
      e.target.value='';
    }} /></label>
    <button type="button" className="ml-3 underline" onClick={()=>save(defaultMarketSnapshot)}>Use bundled snapshot</button>
    {error&&<p role="alert" className="mt-2 text-amber-300">{error}</p>}
  </details>;
}
