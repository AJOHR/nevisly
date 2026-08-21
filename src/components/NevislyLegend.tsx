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


            {/* SCORE */}
            <section>
              <h3 className="font-bold text-emerald-400">
                Nevisly Score
              </h3>

              <p className="mt-1">
                Overall championship value rating.
                Higher scores indicate stronger draft
                recommendations.
              </p>

              <p className="mt-2">
                Built from:
              </p>

              <ul className="ml-4 mt-1 list-disc">
                <li>Value Over Replacement (VOR)</li>
                <li>H2H category impact</li>
                <li>Team category needs</li>
                <li>Position scarcity</li>
                <li>Schedule advantage</li>
                <li>Position flexibility</li>
                <li>Projection confidence</li>
              </ul>

              <p className="mt-2 text-zinc-500">
                Designed for winning H2H categories,
                not simply maximizing points.
              </p>
            </section>



            {/* PROJECTION */}
            <section>
              <h3 className="font-bold text-emerald-400">
                Projection Confidence
              </h3>

              <p className="mt-1">
                Shows how much agreement exists between
                projection systems. Confidence measures
                projection reliability, not player talent.
              </p>

              <ul className="ml-4 mt-2 list-disc">
                <li>
                  <strong className="text-emerald-400">
                    HIGH
                  </strong>{" "}
                  = multiple sources strongly agree
                  <span className="text-zinc-500">
                    {" "}
                    (variance ≤ 5)
                  </span>
                </li>

                <li>
                  <strong className="text-yellow-400">
                    MEDIUM
                  </strong>{" "}
                  = moderate disagreement between sources
                  <span className="text-zinc-500">
                    {" "}
                    (variance &gt; 5 and ≤ 15)
                  </span>
                </li>

                <li>
                  <strong className="text-red-400">
                    LOW
                  </strong>{" "}
                  = single source or large disagreement
                  <span className="text-zinc-500">
                    {" "}
                    (variance &gt; 15)
                  </span>
                </li>
              </ul>


              <div className="mt-3">
                <strong className="text-zinc-300">
                  Projection Sources
                </strong>

                <p>
                  Number of projection models contributing
                  to the player's projection.
                </p>

                <p className="text-zinc-500">
                  Example: 3 sources means three projection
                  systems contribute to the final projection.
                </p>
              </div>


              <div className="mt-3">
                <strong className="text-zinc-300">
                  Variance
                </strong>

                <p>
                  Measures how far apart projection sources
                  are from each other.
                </p>

                <p className="text-zinc-500">
                  Lower variance = stronger agreement.
                  Higher variance = more uncertainty.
                </p>

                <p className="mt-2 text-zinc-500">
                  Example:
                  Variance 2 means projection systems are
                  separated by approximately 2 projected points.
                </p>

                <p className="mt-2 text-zinc-500">
                  Variance cannot be judged from a single
                  projection source.
                </p>
              </div>


              <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                <strong className="text-zinc-300">
                  Important:
                </strong>

                <p className="mt-1 text-zinc-500">
                  LOW confidence does not mean a bad player.
                  It means the projection has less certainty.
                  A superstar with only one projection source
                  will still show LOW confidence.
                </p>
              </div>
            </section>




            {/* CATEGORIES */}
            <section>
              <h3 className="font-bold text-emerald-400">
                Category Tags
              </h3>


              <div className="mt-2">
                <strong className="text-zinc-300">
                  #1 Category
                </strong>

                <p>
                  The best remaining player in that
                  specific category.
                </p>

                <p className="text-zinc-500">
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
                  Statistically excellent production
                  compared to the entire player pool.
                </p>

                <p className="text-zinc-500">
                  Example:
                  Elite PPP means the player provides
                  elite power-play production.
                </p>

                <p className="text-zinc-500">
                  A player can be Elite without being
                  #1 because several players may have
                  elite production.
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
                  Measures how much better a player is
                  than the replacement option.
                </p>
              </div>



              <div className="mt-3">
                <strong className="text-zinc-300">
                  H2H Gain
                </strong>

                <p>
                  Estimated improvement to weekly
                  category matchup strength.
                </p>
              </div>


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
                  Number of picks before your next turn.
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
                  NHL games during Yahoo fantasy playoff
                  weeks 24-26.
                </p>
              </div>


              <div className="mt-3">
                <strong className="text-zinc-300">
                  OFF
                </strong>

                <p>
                  Off-night games where players avoid
                  crowded NHL schedules.
                </p>
              </div>

            </section>




            {/* HEATMAP */}
            <section>
              <h3 className="font-bold text-emerald-400">
                Heatmap
              </h3>

              <p>
                Category strength compared to the player
                pool.
              </p>

              <ul className="ml-4 mt-2 list-disc">
                <li>Green = above average</li>
                <li>Bright green = elite</li>
                <li>Red = weakness</li>
              </ul>

              <p className="mt-2 text-zinc-500">
                Based on statistical Z-score.
              </p>
            </section>


          </div>
        </div>
      )}
    </div>
  );
}