"use client";
import { useState } from 'react';
export default function NevislyLegend() {
  const [open,setOpen]=useState(false);
  return <div className="relative">
    <button type="button" aria-expanded={open} onClick={()=>setOpen(!open)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-bold text-zinc-300">? Legend</button>
    {open&&<div className="absolute right-0 top-10 z-50 max-h-[80vh] w-80 max-w-[90vw] space-y-4 overflow-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs text-zinc-400 shadow-xl">
      <h3 className="font-bold text-white">How recommendations work</h3>
      <p><strong className="text-emerald-400">Player Value</strong> is intrinsic, position-neutral skater value versus the overall league starter baseline. Each category uses the same bounded utility curve, so eventual positional fringe depth cannot make an early defenseman look valuable merely because D40 is weak.</p>
      <p><strong className="text-emerald-400">Team Fit</strong> adds feasible positional scarcity only as your real roster provides evidence that a slot matters, then adjusts for category context and playoff usable production. Empty rosters receive no fixed positional scarcity premium. Unknown picks make that estimate less certain.</p>
      <p><strong className="text-emerald-400">Draft Urgency</strong> uses a cached Yahoo standard-scoring ADP order for opponent demand, including market-listed goalies and unprojected players. On the clock it compares bounded paths through the next two own selections when both turns remain. SAFE/POSSIBLE/RISKY mean outside/near/inside the market-order removal window, not survival probabilities. Missing or ambiguous ADP is UNKNOWN and is not assumed available as a future target.</p>
      <p>The future-pick search keeps a small cross-position shortlist, removes opponent selections in Yahoo market order between each snake turn, and retains earlier hypothetical picks in the projected roster. It is a bounded three-pick model, not a full-draft simulator.</p>
      <p><strong className="text-emerald-400">Uncertainty</strong> includes projection-source agreement, missing metadata, unknown selections and absent schedule data. Age is a review note, not another automatic production penalty.</p>
      <p>Seven equally weighted skater categories: G, A, P, PPP, SOG, HIT, BLK. G/A/P remain separate because each scores in this league. C2/LW2/RW2/D4, two goalie slots and four shared bench slots are retained. The separate Goalie tab scores W, SV% and SO and labels projected STARTER/TANDEM/BACKUP workload; goalie scoring never mixes into skater Player Value.</p>
      <p>The normalization reference scales with league size (250 slots at 12 teams), using unique roster-proportional slots by projected points, including 40% D slots when depth permits. Category fit uses a smooth saturation utility and a market prior for incomplete opponents. Bench depth uses intrinsic value. These are explicit model assumptions, not Yahoo observations.</p>
      <p><strong className="text-zinc-200">Projection agreement</strong> describes source dispersion, not accuracy. A single source cannot establish agreement. The displayed variance field is projected-points standard deviation.</p>
      <p><strong className="text-zinc-200">Schedule</strong>: only Yahoo Weeks 24–26 (March 15–April 4, 2027). With exact NHL dates, Nevisly allocates the projected 14-skater roster into C2/LW2/RW2/D4 on each playoff date, so multi-position eligibility helps only when it creates real lineup access. Missing schedules are neutral, and schedule never changes intrinsic Player Value.</p>
      <p><strong className="text-zinc-200">Heatmap</strong>: green is above the normalization-pool average; red is below. The roster profile is descriptive and does not add another category-need bonus.</p>
    </div>}
  </div>;
}
