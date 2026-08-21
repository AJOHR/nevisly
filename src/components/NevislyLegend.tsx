"use client";

import { useState } from "react";

export default function NevislyLegend() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-800"
      >
        ? Legend
      </button>

      {open && (
        <div className="absolute left-0 top-10 z-50 w-80 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs shadow-xl">
          <div className="mb-3 text-sm font-bold text-white">
            Nevisly Legend
          </div>

          <div className="space-y-3 text-zinc-400">

            <div>
              <div className="font-bold text-emerald-400">
                Projection Confidence
              </div>
              <div>
                HIGH = Multiple sources agree
              </div>
              <div>
                MEDIUM = One projection source
              </div>
              <div>
                LOW = Limited projection data
              </div>
            </div>

            <div>
              <div className="font-bold text-emerald-400">
                Elite Categories
              </div>
              <div>
                Elite G = Top goal scorer profile
              </div>
              <div>
                Elite A = Elite assist upside
              </div>
              <div>
                Elite PPP = Power play production
              </div>
            </div>

            <div>
              <div className="font-bold text-emerald-400">
                Scarcity
              </div>
              <div>
                Scarce D Value = Defensemen are harder to replace
              </div>
            </div>

            <div>
              <div className="font-bold text-emerald-400">
                H2H Impact
              </div>
              <div>
                Prioritizes category wins, not just total points.
              </div>
            </div>

            <div>
              <div className="font-bold text-emerald-400">
                Schedule
              </div>
              <div>
                PO = Fantasy playoff games
              </div>
              <div>
                OFF = Off-night games (better lineup flexibility)
              </div>
            </div>

            <div>
              <div className="font-bold text-emerald-400">
                Gone Risk
              </div>
              <div>
                Chance a player is drafted before your next pick.
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}