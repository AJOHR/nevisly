"use client";

import type { RankedPlayer } from "@/components/ProjectionUpload";

type Props = {
  player: RankedPlayer;
};

export default function PlayerExplanationCard({
  player,
}: Props) {

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">

      <div className="mb-3">
        <div className="text-lg font-black text-white">
          {player.name}
        </div>

        <div className="text-xs text-zinc-500">
          {player.positions.join("/")} · {player.team}
        </div>
      </div>


      <section className="mb-4">

        <h3 className="text-xs font-bold uppercase text-emerald-400">
          Nevisly Score
        </h3>

        <div className="mt-1 text-3xl font-black text-white">
          {player.score.toFixed(2)}
        </div>

      </section>



      <section className="mb-4">

        <h3 className="text-xs font-bold uppercase text-emerald-400">
          Why Nevisly Likes Him
        </h3>


        <ul className="mt-2 space-y-1 text-xs text-zinc-300">

          {player.h2hGain > 0 && (
            <li>
              ✓ Improves H2H category profile
            </li>
          )}


          {player.vor > 0 && (
            <li>
              ✓ Positive replacement value
            </li>
          )}


          {player.positions.length > 1 && (
            <li>
              ✓ Position flexibility:
              {" "}
              {player.positions.join("/")}
            </li>
          )}


          {player.playoffGames >= 11 && (
            <li>
              ✓ Strong playoff schedule
            </li>
          )}


          {player.scarcityReasons.length > 0 && (
            <li>
              ✓ {player.scarcityReasons[0]}
            </li>
          )}

        </ul>

      </section>




      <section className="mb-4">

        <h3 className="text-xs font-bold uppercase text-emerald-400">
          Projection Trust
        </h3>


        <div className="mt-2 text-xs text-zinc-300">

          Confidence:
          {" "}
          <span className="font-bold">
            {player.projectionConfidence}
          </span>

          <br />

          Sources:
          {" "}
          {player.projectionSources}

          <br />

          Variance:
          {" "}
          {player.projectionVariance}

        </div>

      </section>




      <section>

        <h3 className="text-xs font-bold uppercase text-emerald-400">
          Risk
        </h3>


        <div className="mt-2 text-xs text-zinc-300">

          Gone Risk:
          {" "}
          {Math.round(
            player.returnProbability * 100
          )}
          %

          <br />

          {player.returnReason}

        </div>


      </section>


    </div>
  );
}