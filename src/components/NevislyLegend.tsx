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
        <div className="absolute right-0 top-10 z-50 w-96 max-h-[80vh] overflow-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs shadow-xl">

          <div className="mb-4 text-sm font-black text-white">
            Nevisly Draft Intelligence Legend
          </div>

          <div className="space-y-5 text-zinc-400">

            {/* NEVISLY SCORE */}
            <section>
              <h3 className="font-bold text-emerald-400">
                Nevisly Score
              </h3>

              <p className="mt-1">
                Overall championship value ranking.
                Higher = better draft value.
              </p>

              <p className="mt-2">
                Combines:
              </p>

              <ul className="ml-4 mt-1 list-disc">
                <li>Value Over Replacement (VOR)</li>
                <li>H2H category impact</li>
                <li>Team needs</li>
                <li>Position scarcity</li>
                <li>Playoff schedule</li>
                <li>Position flexibility</li>
                <li>Projection confidence</li>
              </ul>

              <p className="mt-2 text-zinc-500">
                Built to maximize H2H category wins,
                not just regular-season points.
              </p>
            </section>


            {/* H2H */}
            <section>
              <h3 className="font-bold text-emerald-400">
                H2H Metrics
              </h3>

              <div className="mt-2">
                <strong className="text-zinc-300">
                  H2H Win %
                </strong>

                <p>
                  Estimated probability of winning a
                  weekly matchup based on projected
                  category strength.
                </p>
              </div>

              <div className="mt-3">
                <strong className="text-zinc-300">
                  Avg Cats
                </strong>

                <p>
                  Average categories expected to win
                  each matchup.
                </p>

                <p className="mt-1 text-zinc-500">
                  League categories:
                  G · A · P · PPP · SOG · HIT · BLK
                </p>

                <p className="mt-1 text-zinc-500">
                  Example:
                  4.8 / 7 means the roster is
                  projected to win about 5 categories
                  per matchup.
                </p>
              </div>

              <div className="mt-3">
                <strong className="text-zinc-300">
                  Projected Record
                </strong>

                <p>
                  Estimated season record based on
                  projected weekly category wins.
                </p>
              </div>
            </section>


            {/* CATEGORY TAGS */}
            <section>
              <h3 className="font-bold text-emerald-400">
                Category Tags
              </h3>

              <div className="mt-2">
                <strong className="text-zinc-300">
                  #1 Category
                </strong>

                <p>
                  Best remaining player in that category.
                </p>

                <p className="mt-1 text-zinc-500">
                  Example:
                  #1 A = highest assist projection
                  available.
                </p>
              </div>


              <div className="mt-3">
                <strong className="text-zinc-300">
                  Elite Category
                </strong>

                <p>
                  Statistically elite production compared
                  to the overall player pool.
                </p>

                <p className="mt-1 text-zinc-500">
                  Example:
                  Elite PPP = elite power-play
                  production.
                </p>
              </div>

            </section>


            {/* VALUE */}
            <section>
              <h3 className="font-bold text-emerald-400">
                Value Metrics
              </h3>

              <div className="mt-2">
                <strong className="text-zinc-300">
                  VOR
                </strong>

                <p>
                  Value Over Replacement.
                  How much better a player is compared
                  to an available replacement.
                </p>
              </div>


              <div className="mt-3">
                <strong className="text-zinc-300">
                  Scarce D Value
                </strong>

                <p>
                  Rewards elite defensemen because
                  quality D production is harder to
                  replace.
                </p>
              </div>


              <div className="mt-3">
                <strong className="text-zinc-300">
                  H2H Gain
                </strong>

                <p>
                  How much a player improves your
                  matchup category profile.
                </p>
              </div>

            </section>


            {/* PROJECTION */}
            <section>
              <h3 className="font-bold text-emerald-400">
                Projection Confidence
              </h3>

              <p className="mt-1">
                Measures how much projection support
                exists.
              </p>

              <ul className="ml-4 mt-2 list-disc">
                <li>
                  HIGH = multiple projection sources agree
                </li>
                <li>
                  MEDIUM = one projection source
                </li>
                <li>
                  LOW = limited projection support
                </li>
              </ul>
            </section>


            {/* RISK */}
            <section>
              <h3 className="font-bold text-emerald-400">
                Draft Risk
              </h3>

              <div className="mt-2">
                <strong className="text-zinc-300">
                  Gone Risk
                </strong>

                <p>
                  Probability another team drafts the
                  player before your next pick.
                </p>
              </div>

              <div className="mt-3">
                <strong className="text-zinc-300">
                  Picks Until Yours
                </strong>

                <p>
                  Number of selections before your next
                  draft opportunity.
                </p>
              </div>

            </section>


            {/* SCHEDULE */}
            <section>
              <h3 className="font-bold text-emerald-400">
                Schedule
              </h3>

              <div className="mt-2">
                <strong className="text-zinc-300">
                  PO
                </strong>

                <p>
                  Fantasy playoff games.
                </p>
              </div>

              <div className="mt-3">
                <strong className="text-zinc-300">
                  OFF
                </strong>

                <p>
                  Off-night games where players are
                  less likely to overlap with busy NHL
                  nights.
                </p>
              </div>

            </section>

          </div>
        </div>
      )}
    </div>
  );
}