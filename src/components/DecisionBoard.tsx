"use client";

import type { Recommendation } from '@/lib/model/engine';
import PowerPlayBadge from '@/components/PowerPlayBadge';
import { powerPlayKey, type PowerPlayAssignment } from '@/lib/nhl/powerPlay';

type Props = {players:Recommendation[]; onInspect:(player:Recommendation)=>void; onDraft:(id:string)=>void; rosterFull:boolean; powerPlayByPlayer?:ReadonlyMap<string,PowerPlayAssignment>};
const signed=(value:number)=>`${value>=0?'+':''}${value.toFixed(2)}`;

export default function DecisionBoard({players,onInspect,onDraft,rosterFull,powerPlayByPlayer}:Props) {
  return <section aria-label="Draft recommendations" className="mb-4 overflow-hidden rounded-xl border border-emerald-800/60 bg-zinc-900">
    <header className="border-b border-zinc-800 px-3 py-2.5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Your next decision</p>
          <h2 className="text-base font-bold">Best available skaters</h2>
        </div>
        <p className="text-[11px] text-zinc-500">Final score = Value + Fit + market timing</p>
      </div>
    </header>
    {rosterFull ? <p className="p-3 text-sm text-amber-300">Your configured roster is full. Review draft history before making another selection.</p> :
      <ol className="divide-y divide-zinc-800">{players.map((player,index)=>{
        const {decision}=player;
        const recommendationLabel=index===0?'BEST PICK NOW':index===1?'NEXT BEST':'ALTERNATIVE';
        const recommendationClass=index===0
          ? 'border-emerald-600 bg-emerald-950/70 text-emerald-200'
          : index===1
            ? 'border-zinc-600 bg-zinc-800 text-zinc-100'
            : 'border-zinc-700 bg-zinc-950 text-zinc-400';
        const marketTimingClass=player.returnRisk==='RISKY'
          ? 'text-amber-300'
          : player.returnRisk==='POSSIBLE'
            ? 'text-yellow-200'
            : player.returnRisk==='SAFE'
              ? 'text-emerald-300'
              : 'text-zinc-400';
        return <li key={player.id} className={`px-3 py-2.5 ${index===0?'bg-emerald-950/25':''}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded border px-1.5 py-0.5 text-[9px] font-black tracking-wide ${recommendationClass}`}>{recommendationLabel}</span>
                <button type="button" onClick={()=>onInspect(player)} className="text-left text-sm font-bold hover:text-emerald-300 focus-visible:outline-emerald-400">
                  <span className="mr-1.5 text-emerald-400">{index+1}.</span>{player.name}
                </button>
                <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">{player.positions.join('/')} · {player.team} <PowerPlayBadge assignment={powerPlayByPlayer?.get(powerPlayKey(player.name,player.team))} /></span>
              </div>
              <p className="mt-1.5 text-xs leading-5 text-zinc-300">{player.explanations[0] ?? 'Compare projected value and uncertainty'}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[9px] uppercase tracking-wide text-zinc-500">Score</div>
                <div className="text-lg font-black tabular-nums text-emerald-400">{player.score.toFixed(2)}</div>
              </div>
              <button type="button" aria-label={`Draft ${player.name} to my team`} onClick={()=>onDraft(player.id)} className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-black text-black hover:bg-emerald-400">MY PICK</button>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-400">
            <span>Value <strong className="text-zinc-200">{decision.playerValue.score.toFixed(2)}</strong></span>
            <span>Fit <strong className="text-zinc-200">{signed(decision.teamFit.adjustment)}</strong></span>
            <span>Timing <strong className="text-zinc-200">{signed(decision.draftUrgency.adjustment)}</strong></span>
            <span>Market <strong className={marketTimingClass}>{player.returnRisk}</strong></span>
            <span>{decision.draftUrgency.opponentSelections} opponents to next turn</span>
          </div>

          <details className="mt-1.5 text-[11px] text-zinc-500">
            <summary className="cursor-pointer select-none hover:text-zinc-300">Details · market reasoning &amp; uncertainty</summary>
            <div className="mt-1.5 space-y-1 border-l border-zinc-800 pl-2">
              <p>{player.returnReason}</p>
              {player.explanations.length>1&&<p>{player.explanations.slice(1,2).join(' · ')}</p>}
              {decision.uncertainty.warnings.length>0&&<ul className="list-disc pl-4">{decision.uncertainty.warnings.map(w=><li key={w}>{w}</li>)}</ul>}
              <button type="button" onClick={()=>onInspect(player)} className="text-emerald-400 underline underline-offset-2">Explain full score</button>
            </div>
          </details>
        </li>;
      })}</ol>}
  </section>;
}
