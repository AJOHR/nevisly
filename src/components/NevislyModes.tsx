'use client';
import {useState,type ReactNode} from 'react';
import LiveSeasonMode from './LiveSeasonMode';
export default function NevislyModes({children}:{children:ReactNode}){
 const [mode,setMode]=useState<'Draft'|'Season'>('Draft');
 return <div className="min-h-screen bg-zinc-950 text-white">
  <div className="flex items-center gap-4 border-b border-zinc-800 px-4 py-2"><span className="text-sm font-bold">NEVISLY</span><nav aria-label="Nevisly mode" className="flex gap-2">{(['Draft','Season'] as const).map(m=><button type="button" key={m} aria-pressed={mode===m} onClick={()=>setMode(m)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${mode===m?'bg-emerald-400 text-black':'bg-zinc-800'}`}>{m}</button>)}</nav></div>
  {/* Keep the Draft subtree mounted: its uploads, session and controls own their existing state. */}
  <div hidden={mode!=='Draft'}>{children}</div>
  {mode==='Season'&&<LiveSeasonMode/>}
 </div>;
}
