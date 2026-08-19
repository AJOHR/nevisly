"use client";

import { useMemo, useState } from "react";
import { parseSkaterCsv } from "@/lib/projections/parseSkaterCsv";
import type { SkaterProjection } from "@/types/player";

const categoryKeys = [
  "goals",
  "assists",
  "points",
  "ppp",
  "sog",
  "hits",
  "blocks",
] as const;

type CategoryKey = (typeof categoryKeys)[number];

type RankedPlayer = SkaterProjection & {
  rawScore: number;
  vor: number;
  score: number;
  replacementPosition: string;
  zScores: Record<CategoryKey, number>;
};

type SortKey =
  | "name"
  | "team"
  | "score"
  | "vor"
  | "gp"
  | "goals"
  | "assists"
  | "points"
  | "ppp"
  | "sog"
  | "hits"
  | "blocks";

type SortDirection = "asc" | "desc";

const STARTERS_PER_TEAM: Record<string, number> = {
  C: 2,
  LW: 2,
  RW: 2,
  D: 4,
};

export default function ProjectionUpload() {
  const [players, setPlayers] = useState<SkaterProjection[]>([]);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState("ALL");

  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("desc");

  const [draftedIds, setDraftedIds] = useState<Set<string>>(
    new Set()
  );

  const [showDrafted, setShowDrafted] = useState(false);

  const [leagueTeams, setLeagueTeams] = useState(12);

  async function handleFile(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      setError("");

      const parsedPlayers = await parseSkaterCsv(file);

      setPlayers(parsedPlayers);
      setDraftedIds(new Set());
    } catch {
      setError("Could not read projection file.");
    }
  }

  const rankedPlayers = useMemo<RankedPlayer[]>(() => {
    if (players.length === 0) return [];

    /*
     * Z-SCORE BASELINE
     *
     * We use the top 250 fantasy-relevant skaters rather than
     * all fringe NHL players.
     */
    const fantasyPool = [...players]
      .sort((a, b) => b.points - a.points)
      .slice(0, 250);

    const stats = {} as Record<
      CategoryKey,
      { mean: number; stdDev: number }
    >;

    for (const category of categoryKeys) {
      const values = fantasyPool.map(
        (player) => player[category]
      );

      const mean =
        values.reduce((sum, value) => sum + value, 0) /
        values.length;

      const variance =
        values.reduce(
          (sum, value) =>
            sum + Math.pow(value - mean, 2),
          0
        ) / values.length;

      stats[category] = {
        mean,
        stdDev: Math.sqrt(variance),
      };
    }

    /*
     * FIRST PASS:
     * Calculate raw 7-category Z-score.
     */
    const basePlayers = players.map((player) => {
      const zScores = {} as Record<CategoryKey, number>;

      let rawScore = 0;

      for (const category of categoryKeys) {
        const { mean, stdDev } = stats[category];

        const zScore =
          stdDev === 0
            ? 0
            : (player[category] - mean) / stdDev;

        zScores[category] = zScore;
        rawScore += zScore;
      }

      return {
        ...player,
        rawScore,
        zScores,
      };
    });

    /*
     * REPLACEMENT LEVELS
     *
     * Example with a 12-team league:
     *
     * C  = 12 × 2 = 24th C
     * LW = 12 × 2 = 24th LW
     * RW = 12 × 2 = 24th RW
     * D  = 12 × 4 = 48th D
     */
    const replacementScores: Record<string, number> = {};

    for (const position of ["C", "LW", "RW", "D"]) {
      const requiredStarters =
        leagueTeams * STARTERS_PER_TEAM[position];

      const positionalPlayers = basePlayers
        .filter((player) =>
          player.positions.includes(position)
        )
        .sort((a, b) => b.rawScore - a.rawScore);

      const replacementIndex = Math.max(
        0,
        Math.min(
          requiredStarters - 1,
          positionalPlayers.length - 1
        )
      );

      replacementScores[position] =
        positionalPlayers[replacementIndex]?.rawScore ?? 0;
    }

    /*
     * SECOND PASS:
     * Calculate Value Over Replacement.
     *
     * Multi-position players receive the best VOR available
     * across their eligible positions.
     */
    return basePlayers.map((player) => {
      const eligiblePositions = player.positions.filter(
        (position) =>
          replacementScores[position] !== undefined
      );

      let bestVor = Number.NEGATIVE_INFINITY;
      let bestPosition = eligiblePositions[0] ?? "—";

      for (const position of eligiblePositions) {
        const vor =
          player.rawScore - replacementScores[position];

        if (vor > bestVor) {
          bestVor = vor;
          bestPosition = position;
        }
      }

      if (!Number.isFinite(bestVor)) {
        bestVor = player.rawScore;
      }

      return {
        ...player,
        vor: bestVor,

        /*
         * For this version, Nevisly Score IS positional VOR.
         *
         * This avoids an arbitrary scarcity multiplier and makes
         * players directly comparable across positions.
         */
        score: bestVor,

        replacementPosition: bestPosition,
      };
    });
  }, [players, leagueTeams]);

  const filteredPlayers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rankedPlayers
      .filter((player) => {
        if (showDrafted) return true;

        return !draftedIds.has(player.id);
      })
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

          return sortDirection === "asc"
            ? result
            : -result;
        }

        const result =
          Number(aValue) - Number(bValue);

        return sortDirection === "asc"
          ? result
          : -result;
      });
  }, [
    rankedPlayers,
    search,
    positionFilter,
    sortKey,
    sortDirection,
    draftedIds,
    showDrafted,
  ]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) =>
        current === "asc" ? "desc" : "asc"
      );

      return;
    }

    setSortKey(key);

    setSortDirection(
      key === "name" || key === "team"
        ? "asc"
        : "desc"
    );
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return "";

    return sortDirection === "asc" ? " ↑" : " ↓";
  }

  function toggleDrafted(playerId: string) {
    setDraftedIds((current) => {
      const next = new Set(current);

      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }

      return next;
    });
  }

  const positions = ["ALL", "C", "LW", "RW", "D"];

  const draftedCount = draftedIds.size;
  const availableCount = players.length - draftedCount;

  return (
    <main className="min-h-screen bg-zinc-950 p-8 text-white">
      <div className="mx-auto max-w-[1700px]">
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
            <div className="mb-4 grid gap-4 sm:grid-cols-4">
              <StatCard
                label="Players"
                value={players.length}
              />

              <StatCard
                label="Available"
                value={availableCount}
              />

              <StatCard
                label="Drafted"
                value={draftedCount}
              />

              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                <label className="mb-2 block text-sm text-zinc-400">
                  League Teams
                </label>

                <select
                  value={leagueTeams}
                  onChange={(event) =>
                    setLeagueTeams(
                      Number(event.target.value)
                    )
                  }
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
                >
                  {[8, 10, 12, 14, 16, 18, 20].map(
                    (teams) => (
                      <option
                        key={teams}
                        value={teams}
                      >
                        {teams}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            <div className="mb-4 flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
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

              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={showDrafted}
                  onChange={(event) =>
                    setShowDrafted(
                      event.target.checked
                    )
                  }
                />

                Show drafted players
              </label>
            </div>

            <div className="mb-3 text-sm text-zinc-400">
              Showing {filteredPlayers.length} players
            </div>

            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900 text-left">
                  <tr>
                    <th className="p-3">Draft</th>

                    <SortableHeader
                      label="Player"
                      onClick={() =>
                        handleSort("name")
                      }
                      indicator={sortIndicator("name")}
                    />

                    <th className="p-3">Pos</th>

                    <SortableHeader
                      label="Team"
                      onClick={() =>
                        handleSort("team")
                      }
                      indicator={sortIndicator("team")}
                    />

                    <SortableHeader
                      label="Score"
                      onClick={() =>
                        handleSort("score")
                      }
                      indicator={sortIndicator("score")}
                    />

                    <SortableHeader
                      label="VOR"
                      onClick={() =>
                        handleSort("vor")
                      }
                      indicator={sortIndicator("vor")}
                    />

                    <th className="p-3">
                      VOR Pos
                    </th>

                    <SortableHeader
                      label="GP"
                      onClick={() =>
                        handleSort("gp")
                      }
                      indicator={sortIndicator("gp")}
                    />

                    <SortableHeader
                      label="G"
                      onClick={() =>
                        handleSort("goals")
                      }
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
                      onClick={() =>
                        handleSort("points")
                      }
                      indicator={sortIndicator("points")}
                    />

                    <SortableHeader
                      label="PPP"
                      onClick={() =>
                        handleSort("ppp")
                      }
                      indicator={sortIndicator("ppp")}
                    />

                    <SortableHeader
                      label="SOG"
                      onClick={() =>
                        handleSort("sog")
                      }
                      indicator={sortIndicator("sog")}
                    />

                    <SortableHeader
                      label="HIT"
                      onClick={() =>
                        handleSort("hits")
                      }
                      indicator={sortIndicator("hits")}
                    />

                    <SortableHeader
                      label="BLK"
                      onClick={() =>
                        handleSort("blocks")
                      }
                      indicator={sortIndicator("blocks")}
                    />

                    <th className="p-3">
                      PO Games
                    </th>

                    <th className="p-3">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredPlayers.map((player) => {
                    const drafted =
                      draftedIds.has(player.id);

                    return (
                      <tr
                        key={player.id}
                        className={`border-t border-zinc-800 ${
                          drafted
                            ? "opacity-40"
                            : "hover:bg-zinc-900/60"
                        }`}
                      >
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() =>
                              toggleDrafted(player.id)
                            }
                            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs hover:border-zinc-500"
                          >
                            {drafted
                              ? "Undo"
                              : "Drafted"}
                          </button>
                        </td>

                        <td className="p-3 font-medium">
                          {player.name}
                        </td>

                        <td className="p-3">
                          {player.positions.join(", ")}
                        </td>

                        <td className="p-3">
                          {player.team}
                        </td>

                        <td className="p-3 font-bold">
                          {player.score.toFixed(2)}
                        </td>

                        <td className="p-3">
                          {player.vor.toFixed(2)}
                        </td>

                        <td className="p-3 text-zinc-400">
                          {player.replacementPosition}
                        </td>

                        <td className="p-3">
                          {player.gp}
                        </td>

                        <HeatmapCell
                          value={player.goals}
                          zScore={
                            player.zScores.goals
                          }
                        />

                        <HeatmapCell
                          value={player.assists}
                          zScore={
                            player.zScores.assists
                          }
                        />

                        <HeatmapCell
                          value={player.points}
                          zScore={
                            player.zScores.points
                          }
                        />

                        <HeatmapCell
                          value={player.ppp}
                          zScore={
                            player.zScores.ppp
                          }
                        />

                        <HeatmapCell
                          value={player.sog}
                          zScore={
                            player.zScores.sog
                          }
                        />

                        <HeatmapCell
                          value={player.hits}
                          zScore={
                            player.zScores.hits
                          }
                        />

                        <HeatmapCell
                          value={player.blocks}
                          zScore={
                            player.zScores.blocks
                          }
                        />

                        <td className="p-3 text-zinc-500">
                          —
                        </td>

                        <td className="p-3 text-zinc-500">
                          —
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function HeatmapCell({
  value,
  zScore,
}: {
  value: number;
  zScore: number;
}) {
  return (
    <td
      className="p-3 font-medium"
      style={getHeatmapStyle(zScore)}
      title={`Z-score: ${zScore.toFixed(2)}`}
    >
      {value}
    </td>
  );
}

function getHeatmapStyle(
  zScore: number
): React.CSSProperties {
  if (zScore >= 2) {
    return {
      backgroundColor: "rgba(22, 163, 74, 0.70)",
      color: "#ffffff",
    };
  }

  if (zScore >= 1) {
    return {
      backgroundColor: "rgba(22, 163, 74, 0.42)",
      color: "#dcfce7",
    };
  }

  if (zScore >= 0.35) {
    return {
      backgroundColor: "rgba(22, 163, 74, 0.20)",
    };
  }

  if (zScore > -0.35) {
    return {
      backgroundColor: "rgba(113, 113, 122, 0.10)",
    };
  }

  if (zScore > -1) {
    return {
      backgroundColor: "rgba(220, 38, 38, 0.18)",
    };
  }

  if (zScore > -2) {
    return {
      backgroundColor: "rgba(220, 38, 38, 0.38)",
      color: "#fee2e2",
    };
  }

  return {
    backgroundColor: "rgba(220, 38, 38, 0.65)",
    color: "#ffffff",
  };
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="text-sm text-zinc-400">
        {label}
      </div>

      <div className="mt-1 text-2xl font-bold">
        {value}
      </div>
    </div>
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