"use client";

import type { Recommendation } from '@/lib/model/engine';
import PowerPlayBadge from '@/components/PowerPlayBadge';
import { powerPlayKey, type PowerPlayAssignment } from '@/lib/nhl/powerPlay';

type Props = {players:Recommendation[]; onInspect:(player:Recommendation)=>void; onDraft:(id:string)=>void; rosterFull:boolean; powerPlayByPlayer?:ReadonlyMap<string,PowerPlayAssignment>};
const signed=(value:number)=>`${value>=0?'+':''}${value.toFixed(2)}`;

export default function DecisionBoard({players,onInspect,onDraft,rosterFull,powerPlayByPlayer}:Props) {
  return <section aria-label="Draft recommendations" className="mb-5 overflow-hidden rounded-xl border border-emerald-800/60 bg-zinc-900">
    <header className="border-b border-zinc-800 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">Your next decision</p>
      <h2 className="text-lg font-bold">Best available skaters</h2>
      <p className="mt-1 text-xs text-zinc-400">Recommendation order reflects the final Nevisly score. Player Value + Team Fit + market-timing adjustment = recommendation score. Market timing never changes Player Value.</p>
      <details className="mt-2 text-xs text-zinc-400"><summary className="cursor-pointer">Model scope &amp; assumptions</summary>
        <p className="mt-2">G, A, P, PPP, SOG, HIT, BLK · C2 / LW2 / RW2 / D4 / G2 / BN4. Replacement depth uses league starter slots. Bench options use intrinsic value without assumed playing time. Goalie value is unmodeled; these scores are not matchup or championship probabilities.</p>
      </details>
    </header>
    {rosterFull ? <p className="p-4 text-sm text-amber-300">Your configured roster is full. Review draft history before making another selection.</p> :
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
        return <li key={player.id} className={`p-4 ${index===0?'bg-emerald-950/25':''}`}>
          <div className="mb-2 flex items-center gap-2">
            <span className={`rounded border px-2 py-1 text-[10px] font-black tracking-wide ${recommendationClass}`}>{recommendationLabel}</span>
            <span className="text-[10px] text-zinc-500">Recommendation #{index+1}</span>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <button type="button" onClick={()=>onInspect(player)} className="text-left font-bold hover:text-emerald-300 focus-visible:outline-emerald-400"><span className="mr-2 text-emerald-400">{index+1}.</span>{player.name}</button>
              <p className="mt-1 flex items-center gap-2 text-xs text-zinc-400">{player.positions.join('/')} · {player.team} <PowerPlayBadge assignment={powerPlayByPlayer?.get(powerPlayKey(player.name,player.team))} /></p>
              <p className="mt-2 text-sm text-zinc-300">{player.explanations.slice(0,2).join(' · ')}</p>
            </div>
            <button type="button" aria-label={`Draft ${player.name} to my team`} onClick={()=>onDraft(player.id)} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-black hover:bg-emerald-400">MY PICK</button>
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div><dt className="text-zinc-400">Player Value</dt><dd className="mt-1 font-semibold tabular-nums">{decision.playerValue.score.toFixed(2)}</dd></div>
            <div><dt className="text-zinc-400">Team Fit</dt><dd className="mt-1 font-semibold tabular-nums">{signed(decision.teamFit.adjustment)}</dd></div>
            <div><dt className="text-zinc-400">Score</dt><dd className="mt-1 text-lg font-black tabular-nums text-emerald-400">{player.score.toFixed(2)}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-zinc-300" title={player.returnReason}>Market timing: <strong className={marketTimingClass}>{player.returnRisk}</strong> · {signed(decision.draftUrgency.adjustment)} timing adjustment · {decision.draftUrgency.opponentSelections} opponent picks before your next turn</p>
          <p className="mt-1 text-xs text-zinc-400">{player.returnReason.split(';').slice(0,3).join(' · ')}</p>
          <details className="mt-2 text-xs text-zinc-400"><summary className="cursor-pointer">Uncertainty · {decision.uncertainty.warnings.length} notes</summary><ul className="mt-2 list-disc space-y-1 pl-4">{decision.uncertainty.warnings.map(w=><li key={w}>{w}</li>)}</ul></details>
          <button type="button" onClick={()=>onInspect(player)} className="mt-2 text-xs text-emerald-400 underline underline-offset-2">Explain score</button>
        </li>;
      })}</ol>}
  </section>;
}
