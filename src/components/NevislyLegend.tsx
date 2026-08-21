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
                Shows how much Nevisly trusts the
                underlying projection.
              </p>

              <ul className="ml-4 mt-2 list-disc">
                <li>
                  <strong className="text-emerald-400">
                    HIGH
                  </strong>{" "}
                  = multiple sources agree with low
                  variance
                </li>

                <li>
                  <strong className="text-yellow-400">
                    MEDIUM
                  </strong>{" "}
                  = limited source support or normal
                  uncertainty
                </li>

                <li>
                  <strong className="text-red-400">
                    LOW
                  </strong>{" "}
                  = only one source or large projection
                  disagreement
                </li>
              </ul>


              <div className="mt-3">
                <strong className="text-zinc-300">
                  Projection Sources
                </strong>

                <p>
                  Number of projection systems supporting
                  the player.
                </p>

                <p className="text-zinc-500">
                  Example: 3 sources = stronger confidence
                  than 1 source.
                </p>
              </div>


              <div className="mt-3">
                <strong className="text-zinc-300">
                  Variance
                </strong>

                <p>
                  How far apart projection sources are.
                  Lower variance means more agreement.
                </p>

                <p className="text-zinc-500">
                  High variance = player outcome is less
                  predictable.
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
                  Scarce D Value
                </strong>

                <p>
                  Rewards defensemen who provide rare
                  category production.
                </p>

                <p className="text-zinc-500">
                  Example:
                  A defenseman producing elite assists,
                  PPP, shots, hits, and blocks is much
                  harder to replace than a similar winger.
                </p>
              </div>



              <div className="mt-3">
                <strong className="text-zinc-300">
                  H2H Gain
                </strong>

                <p>
                  Estimated improvement to your weekly
                  category matchup profile.
                </p>
              </div>



              <div className="mt-3">
                <strong className="text-zinc-300">
                  Need Weight
                </strong>

                <p>
                  Adjusts rankings based on your roster
                  weaknesses.
                </p>

                <p className="text-zinc-500">
                  Example:
                  If your team lacks shots and hits,
                  those categories become more valuable.
                </p>
              </div>

            </section>





            {/* TEAM METRICS */}
            <section>
              <h3 className="font-bold text-emerald-400">
                Team Projection Metrics
              </h3>


              <div className="mt-2">
                <strong className="text-zinc-300">
                  H2H Win %
                </strong>

                <p>
                  Estimated chance of winning a weekly
                  matchup based on category strength.
                </p>
              </div>


              <div className="mt-3">
                <strong className="text-zinc-300">
                  Avg Cats
                </strong>

                <p>
                  Expected category wins per matchup.
                </p>

                <p className="text-zinc-500">
                  Example:
                  4.5 / 7 means the roster projects to
                  win roughly 4-5 categories weekly.
                </p>
              </div>


              <div className="mt-3">
                <strong className="text-zinc-300">
                  Record
                </strong>

                <p>
                  Projected season record based on
                  matchup simulations.
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
                  Fantasy playoff games during Yahoo
                  playoff weeks.
                </p>
              </div>


              <div className="mt-3">
                <strong className="text-zinc-300">
                  OFF
                </strong>

                <p>
                  Off-night games where players avoid
                  busy NHL schedules.
                </p>
              </div>


              <div className="mt-3">
                <strong className="text-zinc-300">
                  Schedule Bonus
                </strong>

                <p>
                  Rewards players with playoff-friendly
                  schedules.
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