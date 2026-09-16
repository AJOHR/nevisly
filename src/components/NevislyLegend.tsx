"use client";
import { useState } from 'react';
export default function NevislyLegend() {
  const [open,setOpen]=useState(false);
  return <div className="relative">
    <button type="button" aria-expanded={open} onClick={()=>setOpen(!open)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-bold text-zinc-300">? Legend</button>
    {open&&<div className="absolute right-0 top-10 z-50 max-h-[80vh] w-80 max-w-[90vw] space-y-4 overflow-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs text-zinc-400 shadow-xl">
      <h3 className="font-bold text-white">How recommendations work</h3>
      <p><strong className="text-emerald-400">Player Value</strong> is value over an actual feasible market replacement, plus the existing schedule adjustment. Each player fills one position in the allocation, including multi-position players.</p>
      <p><strong className="text-emerald-400">Team Fit</strong> adjusts that baseline for your projected roster opportunity and incremental category utility. Empty slots are filled with available replacement players on both sides of the comparison. Unknown picks make that estimate less certain.</p>
      <p><strong className="text-emerald-400">Draft Urgency</strong> compares available value rank with opponent picks before your next turn. It does not add to the score and is not a calibrated probability.</p>
      <p><strong className="text-emerald-400">Uncertainty</strong> includes projection-source agreement, missing metadata, unknown selections and absent schedule data. Age is a review note, not another automatic production penalty.</p>
      <p>Seven equally weighted skater categories: G, A, P, PPP, SOG, HIT, BLK. G/A/P remain separate because each scores in this league. C2/LW2/RW2/D4, two goalie slots and four shared bench slots are retained. Goalies consume draft slots but are not scored by this model. No overall matchup or championship probability is calculated.</p>
      <p>Top 250 projected points define the normalization pool. Category fit uses a smooth saturation utility and a market prior for incomplete opponents. Bench depth uses intrinsic value without assumed playing time. These are explicit model assumptions, not Yahoo observations.</p>
      <p><strong className="text-zinc-200">Projection agreement</strong> describes source dispersion, not accuracy. A single source cannot establish agreement. The displayed variance field is projected-points standard deviation.</p>
      <p><strong className="text-zinc-200">Schedule</strong>: PO counts playoff games in the existing configured weeks 24–26. Off-night adjustments use supplied schedule data; unavailable schedules add no bonus.</p>
      <p><strong className="text-zinc-200">Heatmap</strong>: green is above the normalization-pool average; red is below. The roster profile is descriptive and does not add another category-need bonus.</p>
    </div>}
  </div>;
}
