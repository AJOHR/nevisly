"use client";

import { useMemo, useState } from "react";
import { parseSkaterCsv } from "@/lib/projections/parseSkaterCsv";
import type { SkaterProjection } from "@/types/player";

type SortKey =
  | "name"
  | "team"
  | "gp"
  | "goals"
  | "assists"
  | "points"
  | "ppp"
  | "sog"
  | "hits"
  | "blocks";

type SortDirection = "asc" | "desc";

export default function ProjectionUpload() {
  const [players, setPlayers] = useState<SkaterProjection[]>([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("points");
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("desc");

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

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) =>
        current === "asc" ? "desc" : "asc"
      );
      return;
    }

    setSortKey(key);
    setSortDirection(
      key === "name" || key === "team" ? "asc" : "desc"
    );
  }

  const filteredPlayers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return players
      .filter((player) => {
        if (!query) return true;

        return (
          player.name.toLowerCase().includes(query) ||
          player.team.toLowerCase().includes(query)
        );
      })
      .filter((player) => {
        if (positionFilter === "ALL") return true;

        return player.positions.includes(positionFilter);
      })
      .sort((a, b) => {
        const aValue = a[sortKey];
        const bValue = b[sortKey];

        if (
          typeof aValue === "string" &&
          typeof bValue === "string"
        ) {
          const result = aValue.localeCompare(bValue);

          return sortDirection === "asc" ? result : -result;
        }

        const result = Number(aValue) - Number(bValue);

        return sortDirection === "asc" ? result : -result;
      });
  }, [
    players,
    search,
    positionFilter,
    sortKey,
    sortDirection,
  ]);

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return "";

    return sortDirection === "asc" ? " ↑" : " ↓";
  }

  const positions = ["ALL", "C", "LW", "RW", "D"];

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
          <>
            <div className="mb-4 flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4 md:flex-row md:items-center md:justify-between">
              <input
                type="text"
                placeholder="Search player or team..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 outline-none placeholder:text-zinc-500 focus:border-zinc-500 md:max-w-md"
              />

              <div className="flex flex-wrap gap-2">
                {positions.map((position) => {
                  const active =
                    positionFilter === position;

                  return (
                    <button
                      key={position}
                      type="button"
                      onClick={() =>
                        setPositionFilter(position)
                      }
                      className={`rounded-lg border px-4 py-2 text-sm transition ${
                        active
                          ? "border-white bg-white text-black"
                          : "border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-500"
                      }`}
                    >
                      {position}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-3 text-sm text-zinc-400">
              Showing {filteredPlayers.length} of{" "}
              {players.length} players
            </div>

            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900 text-left">
                  <tr>
                    <SortableHeader
                      label="Player"
                      onClick={() => handleSort("name")}
                      indicator={sortIndicator("name")}
                    />

                    <th className="p-3">
                      Pos
                    </th>

                    <SortableHeader
                      label="Team"
                      onClick={() => handleSort("team")}
                      indicator={sortIndicator("team")}
                    />

                    <SortableHeader
                      label="GP"
                      onClick={() => handleSort("gp")}
                      indicator={sortIndicator("gp")}
                    />

                    <SortableHeader
                      label="G"
                      onClick={() => handleSort("goals")}
                      indicator={sortIndicator("goals")}
                    />

                    <SortableHeader
                      label="A"
                      onClick={() =>
                        handleSort("assists")
                      }
                      indicator={sortIndicator("assists")}
                    />

                    <SortableHeader
                      label="P"
                      onClick={() => handleSort("points")}
                      indicator={sortIndicator("points")}
                    />

                    <SortableHeader
                      label="PPP"
                      onClick={() => handleSort("ppp")}
                      indicator={sortIndicator("ppp")}
                    />

                    <SortableHeader
                      label="SOG"
                      onClick={() => handleSort("sog")}
                      indicator={sortIndicator("sog")}
                    />

                    <SortableHeader
                      label="HIT"
                      onClick={() => handleSort("hits")}
                      indicator={sortIndicator("hits")}
                    />

                    <SortableHeader
                      label="BLK"
                      onClick={() => handleSort("blocks")}
                      indicator={sortIndicator("blocks")}
                    />
                  </tr>
                </thead>

                <tbody>
                  {filteredPlayers.map((player) => (
                    <tr
                      key={player.id}
                      className="border-t border-zinc-800 hover:bg-zinc-900/60"
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
          </>
        )}
      </div>
    </main>
  );
}

function SortableHeader({
  label,
  onClick,
  indicator,
}: {
  label: string;
  onClick: () => void;
  indicator: string;
}) {
  return (
    <th className="p-3">
      <button
        type="button"
        onClick={onClick}
        className="font-semibold hover:text-zinc-300"
      >
        {label}
        {indicator}
      </button>
    </th>
  );
}