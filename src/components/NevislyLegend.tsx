"use client";
import { useState } from 'react';
export default function NevislyLegend() {
  const [open,setOpen]=useState(false);
  return <div className="relative">
    <button type="button" aria-expanded={open} onClick={()=>setOpen(!open)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-bold text-zinc-300">? Legend</button>
    {open&&<div className="absolute right-0 top-10 z-50 max-h-[80vh] w-80 max-w-[90vw] space-y-4 overflow-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs text-zinc-400 shadow-xl">
      <h3 className="font-bold text-white">How recommendations work</h3>
      <p><strong className="text-emerald-400">Player Value</strong> sums bounded category gains over an actual feasible market replacement. Each category uses the same smooth utility curve, so an extreme standardized advantage cannot grow without limit. Each player fills one position in the allocation, including multi-position players.</p>
      <p><strong className="text-emerald-400">Team Fit</strong> adjusts that baseline for your projected roster opportunity, incremental category utility and playoff usable production. Empty slots are filled with available replacement players on both sides of the comparison. Unknown picks make that estimate less certain.</p>
      <p><strong className="text-emerald-400">Draft Urgency</strong> labels available value rank against opponent picks before your next turn. Its separate score adjustment compares taking this player now plus a feasible next-pick starter upgrade. Opponents are assumed to select by Nevisly Player Value; this is not a calibrated probability or ADP forecast. Player Value and Team Fit stay unchanged.</p>
      <p>The next-pick search checks the top two surviving options per starter position, retains your first pick, and compares upgrades against the same category target. A common next-pick value is subtracted to center scores. Category priors and schedule estimates stay fixed across the two picks. Bench timing, goalie strategy and later rounds are not simulated; back-to-back picks keep the immediate ordering.</p>
      <p><strong className="text-emerald-400">Uncertainty</strong> includes projection-source agreement, missing metadata, unknown selections and absent schedule data. Age is a review note, not another automatic production penalty.</p>
      <p>Seven equally weighted skater categories: G, A, P, PPP, SOG, HIT, BLK. G/A/P remain separate because each scores in this league. C2/LW2/RW2/D4, two goalie slots and four shared bench slots are retained. Goalies consume draft slots but are not scored by this model. No overall matchup or championship probability is calculated.</p>
      <p>The normalization reference scales with league size (250 slots at 12 teams), using unique roster-proportional slots by projected points, including 40% D slots when depth permits. Category fit uses a smooth saturation utility and a market prior for incomplete opponents. Bench depth uses intrinsic value. These are explicit model assumptions, not Yahoo observations.</p>
      <p><strong className="text-zinc-200">Projection agreement</strong> describes source dispersion, not accuracy. A single source cannot establish agreement. The displayed variance field is projected-points standard deviation.</p>
      <p><strong className="text-zinc-200">Schedule</strong>: only Yahoo Weeks 24–26 (March 15–April 4, 2027). Extra estimated usable starts versus available eligible alternatives multiply projected production per scheduled season game. Busy-night starts share congested slots; off nights are assumed usable. This is not a daily-lineup simulation. Missing schedules are neutral, and schedule never changes intrinsic Player Value.</p>
      <p><strong className="text-zinc-200">Heatmap</strong>: green is above the normalization-pool average; red is below. The roster profile is descriptive and does not add another category-need bonus.</p>
    </div>}
  </div>;
}
