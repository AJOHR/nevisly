"use client";

import { useState } from "react";
import { parseSkaterCsv } from "@/lib/projections/parseSkaterCsv";
import type { SkaterProjection } from "@/types/player";

export default function ProjectionUpload() {
  const [players, setPlayers] = useState<SkaterProjection[]>([]);
  const [error, setError] = useState("");

  async function handleFile(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      setError("");

      const parsedPlayers = await parseSkaterCsv(file);

      setPlayers(parsedPlayers);
    } catch {
      setError("Could not read projection file.");
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-8 text-white">
      <div className="mx-auto max-w-7xl">

        <h1 className="mb-2 text-3xl font-bold">
          Nevisly
        </h1>

        <p className="mb-8 text-zinc-400">
          Fantasy Hockey Draft Tool
        </p>

        <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-4 text-xl font-semibold">
            Import Projections
          </h2>

          <input
            type="file"
            accept=".csv"
            onChange={handleFile}
          />

          {error && (
            <p className="mt-4 text-red-400">
              {error}
            </p>
          )}

          {players.length > 0 && (
            <p className="mt-4 text-green-400">
              Loaded {players.length} players
            </p>
          )}
        </div>

        {players.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-zinc-800">

            <table className="w-full text-sm">

              <thead className="bg-zinc-900 text-left">
                <tr>
                  <th className="p-3">Player</th>
                  <th className="p-3">Pos</th>
                  <th className="p-3">Team</th>
                  <th className="p-3">GP</th>
                  <th className="p-3">G</th>
                  <th className="p-3">A</th>
                  <th className="p-3">P</th>
                  <th className="p-3">PPP</th>
                  <th className="p-3">SOG</th>
                  <th className="p-3">HIT</th>
                  <th className="p-3">BLK</th>
                </tr>
              </thead>

              <tbody>
                {players.map((player) => (
                  <tr
                    key={player.id}
                    className="border-t border-zinc-800"
                  >
                    <td className="p-3 font-medium">
                      {player.name}
                    </td>

                    <td className="p-3">
                      {player.positions.join(", ")}
                    </td>

                    <td className="p-3">
                      {player.team}
                    </td>

                    <td className="p-3">
                      {player.gp}
                    </td>

                    <td className="p-3">
                      {player.goals}
                    </td>

                    <td className="p-3">
                      {player.assists}
                    </td>

                    <td className="p-3">
                      {player.points}
                    </td>

                    <td className="p-3">
                      {player.ppp}
                    </td>

                    <td className="p-3">
                      {player.sog}
                    </td>

                    <td className="p-3">
                      {player.hits}
                    </td>

                    <td className="p-3">
                      {player.blocks}
                    </td>
                  </tr>
                ))}
              </tbody>

            </table>

          </div>
        )}

      </div>
    </main>
  );
}