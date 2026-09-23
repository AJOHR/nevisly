"use client";
import type { Recommendation } from '@/lib/model/engine';
import { categoryLabels, type Category } from '@/lib/model/config';
import PowerPlayBadge from '@/components/PowerPlayBadge';
import type { PowerPlayAssignment } from '@/lib/nhl/powerPlay';

const labels:Record<string,string>={replacementValue:'Intrinsic value vs overall skater baseline',schedule:'Schedule lineup access (Team Fit)',rosterOpportunity:'Roster opportunity vs intrinsic baseline',categoryFit:'Incremental category fit',rosterConcentration:'Roster concentration (Team Fit)',draftOpportunity:'Future-pick opportunity (Draft Urgency)',nearTermScarcity:'Near-term position tier scarcity (Draft Urgency)'};
const signed=(value:number)=>`${value>=0?'+':''}${value.toFixed(3)}`;
export default function PlayerExplanationCard({player,powerPlayAssignment}:{player:Recommendation;powerPlayAssignment?:PowerPlayAssignment}) {
  return <section aria-label={`Score explanation for ${player.name}`} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
    <h3 className="text-lg font-bold">{player.name}</h3>
    <p className="flex items-center gap-2 text-xs text-zinc-400">{player.positions.join('/')} · {player.team} <PowerPlayBadge assignment={powerPlayAssignment} /></p>
    <p className="mt-3 text-2xl font-black text-emerald-400">{player.score.toFixed(2)} <span className="text-xs font-normal text-zinc-400">recommendation score</span></p>
    <p className="mt-2 text-sm text-zinc-300">{player.explanations.join(' · ')}</p>
    <dl className="mt-4 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-xs">
      {Object.entries(player.contributions??{}).map(([name,value])=><div className="contents" key={name}><dt className="text-zinc-300">{labels[name]??name}</dt><dd className="text-right tabular-nums">{signed(value)}</dd></div>)}
      <dt className="border-t border-zinc-700 pt-2 font-bold">Player Value</dt><dd className="border-t border-zinc-700 pt-2 text-right tabular-nums">{signed(player.decision.playerValue.score)}</dd>
      <dt className="font-bold">Team Fit</dt><dd className="text-right tabular-nums">{signed(player.decision.teamFit.adjustment)}</dd>
      <dt className="font-bold">Draft Urgency adjustment</dt><dd className="text-right tabular-nums">{signed(player.decision.draftUrgency.adjustment)}</dd>
    </dl>
    <details className="mt-4 text-xs text-zinc-400"><summary className="cursor-pointer">Category comparison</summary>
      <p className="my-2">Full projected lineups compared through feasible exchanges. Production gain is in player-standard-deviation units. A bounded neutral gain prevents extreme categories dominating; fit adjusts for your roster evidence. These are utility scores, not probabilities.</p>
      <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>Category</th><th>Production gain</th><th>Neutral gain</th><th>Fit adjustment</th></tr></thead><tbody>{Object.entries(player.fit.categories).map(([c,v])=><tr key={c}><th className="py-1">{categoryLabels[c as Category]}</th><td className="tabular-nums">{signed(v.productionGain)}</td><td className="tabular-nums">{signed(v.neutralGain)}</td><td className="tabular-nums">{signed(v.adjustment)}</td></tr>)}</tbody></table></div>
    </details>
    <p className="mt-4 text-xs text-zinc-300">Draft Urgency: <strong>{player.decision.draftUrgency.level}</strong>. {player.returnReason}</p>
    <h4 className="mt-4 text-xs font-bold text-amber-300">Uncertainty</h4>
    <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-zinc-400">{player.decision.uncertainty.warnings.map(w=><li key={w}>{w}</li>)}</ul>
    <p className="mt-3 text-xs text-zinc-500">Projection sources: {player.projectionSources??1} · Agreement: {player.projectionConfidence??'LOW'} · Points standard deviation: {player.projectionVariance??'unavailable'}. Agreement does not establish forecast accuracy.</p>
  </section>;
}
