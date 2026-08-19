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

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  goals: "G",
  assists: "A",
  points: "P",
  ppp: "PPP",
  sog: "SOG",
  hits: "HIT",
  blocks: "BLK",
};

type RankedPlayer = SkaterProjection & {
  rawScore: number;
  vor: number;
  score: number;
  needBonus: number;
  replacementPosition: string;
  zScores: Record<CategoryKey, number>;
};

type BaseRankedPlayer = SkaterProjection & {
  rawScore: number;
  vor: number;
  replacementPosition: string;
  zScores: Record<CategoryKey, number>;
};

type SortKey =
  | "name"
  | "age"
  | "team"
  | "score"
  | "vor"
  | "needBonus"
  | "gp"
  | "goals"
  | "assists"
  | "points"
  | "ppp"
  | "sog"
  | "hits"
  | "blocks";

type SortDirection = "asc" | "desc";

type RosterSlot = {
  id: string;
  position: "C" | "LW" | "RW" | "D" | "BN";
  player?: RankedPlayer;
};

const STARTERS_PER_TEAM: Record<string, number> = {
  C: 2,
  LW: 2,
  RW: 2,
  D: 4,
};

const STARTING_SLOTS = [
  { id: "C1", position: "C" },
  { id: "C2", position: "C" },
  { id: "LW1", position: "LW" },
  { id: "LW2", position: "LW" },
  { id: "RW1", position: "RW" },
  { id: "RW2", position: "RW" },
  { id: "D1", position: "D" },
  { id: "D2", position: "D" },
  { id: "D3", position: "D" },
  { id: "D4", position: "D" },
] as const;

const BENCH_COUNT = 4;

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

  const [myTeamOrder, setMyTeamOrder] = useState<string[]>([]);

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
      setMyTeamOrder([]);
    } catch {
      setError("Could not read projection file.");
    }
  }

  const baseRankedPlayers = useMemo<BaseRankedPlayer[]>(() => {
    if (players.length === 0) return [];

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
        replacementPosition: bestPosition,
      };
    });
  }, [players, leagueTeams]);

  const baseMyTeamPlayers = useMemo(() => {
    const playerMap = new Map(
      baseRankedPlayers.map((player) => [
        player.id,
        player,
      ])
    );

    return myTeamOrder
      .map((id) => playerMap.get(id))
      .filter(
        (player): player is BaseRankedPlayer =>
          player !== undefined
      );
  }, [baseRankedPlayers, myTeamOrder]);

  const teamCategoryStrength = useMemo(() => {
    const result = {} as Record<CategoryKey, number>;

    for (const category of categoryKeys) {
      if (baseMyTeamPlayers.length === 0) {
        result[category] = 0;
        continue;
      }

      const total = baseMyTeamPlayers.reduce(
        (sum, player) =>
          sum + player.zScores[category],
        0
      );

      result[category] =
        total / baseMyTeamPlayers.length;
    }

    return result;
  }, [baseMyTeamPlayers]);

  const teamNeedWeights = useMemo(() => {
    const result = {} as Record<CategoryKey, number>;

    if (baseMyTeamPlayers.length === 0) {
      for (const category of categoryKeys) {
        result[category] = 1;
      }

      return result;
    }

    const strengths = categoryKeys.map(
      (category) => teamCategoryStrength[category]
    );

    const averageStrength =
      strengths.reduce(
        (sum, value) => sum + value,
        0
      ) / strengths.length;

    for (const category of categoryKeys) {
      const relativeStrength =
        teamCategoryStrength[category] -
        averageStrength;

      const weight =
        1 - relativeStrength * 0.18;

      result[category] = Math.max(
        0.75,
        Math.min(1.35, weight)
      );
    }

    return result;
  }, [
    baseMyTeamPlayers.length,
    teamCategoryStrength,
  ]);

  const rankedPlayers = useMemo<RankedPlayer[]>(() => {
    return baseRankedPlayers.map((player) => {
      let needBonus = 0;

      for (const category of categoryKeys) {
        const extraWeight =
          teamNeedWeights[category] - 1;

        needBonus +=
          player.zScores[category] * extraWeight;
      }

      needBonus *= 0.75;

      return {
        ...player,
        needBonus,
        score: player.vor + needBonus,
      };
    });
  }, [baseRankedPlayers, teamNeedWeights]);

  const myTeamPlayers = useMemo(() => {
    const playerMap = new Map(
      rankedPlayers.map((player) => [
        player.id,
        player,
      ])
    );

    return myTeamOrder
      .map((id) => playerMap.get(id))
      .filter(
        (player): player is RankedPlayer =>
          player !== undefined
      );
  }, [rankedPlayers, myTeamOrder]);

  const assignedRoster = useMemo<RosterSlot[]>(() => {
    const starterAssignments = new Map<
      string,
      RankedPlayer
    >();

    function canUseSlot(
      player: RankedPlayer,
      slotPosition: string
    ) {
      return player.positions.includes(slotPosition);
    }

    function tryAssign(
      player: RankedPlayer,
      visitedSlots: Set<string>
    ): boolean {
      for (const slot of STARTING_SLOTS) {
        if (!canUseSlot(player, slot.position)) {
          continue;
        }

        if (visitedSlots.has(slot.id)) {
          continue;
        }

        visitedSlots.add(slot.id);

        const existingPlayer =
          starterAssignments.get(slot.id);

        if (
          !existingPlayer ||
          tryAssign(existingPlayer, visitedSlots)
        ) {
          starterAssignments.set(slot.id, player);
          return true;
        }
      }

      return false;
    }

    const assignmentOrder = [...myTeamPlayers].sort(
      (a, b) =>
        a.positions.length - b.positions.length
    );

    for (const player of assignmentOrder) {
      tryAssign(player, new Set());
    }

    const starters: RosterSlot[] =
      STARTING_SLOTS.map((slot) => ({
        id: slot.id,
        position: slot.position,
        player: starterAssignments.get(slot.id),
      }));

    const starterPlayerIds = new Set(
      [...starterAssignments.values()].map(
        (player) => player.id
      )
    );

    const benchPlayers = myTeamPlayers.filter(
      (player) =>
        !starterPlayerIds.has(player.id)
    );

    const bench: RosterSlot[] = Array.from(
      { length: BENCH_COUNT },
      (_, index) => ({
        id: `BN${index + 1}`,
        position: "BN" as const,
        player: benchPlayers[index],
      })
    );

    return [...starters, ...bench];
  }, [myTeamPlayers]);

  const openStarterPositions = useMemo(() => {
    return assignedRoster
      .filter(
        (slot) =>
          slot.position !== "BN" &&
          !slot.player
      )
      .map((slot) => slot.position);
  }, [assignedRoster]);

  const teamTotals = useMemo(() => {
    return {
      goals: myTeamPlayers.reduce(
        (sum, player) => sum + player.goals,
        0
      ),
      assists: myTeamPlayers.reduce(
        (sum, player) => sum + player.assists,
        0
      ),
      points: myTeamPlayers.reduce(
        (sum, player) => sum + player.points,
        0
      ),
      ppp: myTeamPlayers.reduce(
        (sum, player) => sum + player.ppp,
        0
      ),
      sog: myTeamPlayers.reduce(
        (sum, player) => sum + player.sog,
        0
      ),
      hits: myTeamPlayers.reduce(
        (sum, player) => sum + player.hits,
        0
      ),
      blocks: myTeamPlayers.reduce(
        (sum, player) => sum + player.blocks,
        0
      ),
    };
  }, [myTeamPlayers]);

  /*
   * Top 5 available recommendations.
   */
  const bestAvailable = useMemo(() => {
    return rankedPlayers
      .filter((player) => !draftedIds.has(player.id))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [rankedPlayers, draftedIds]);

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

        return player.positions.includes(
          positionFilter
        );
      })

      .sort((a, b) => {
        const aValue = a[sortKey];
        const bValue = b[sortKey];

        if (
          typeof aValue === "string" &&
          typeof bValue === "string"
        ) {
          const result =
            aValue.localeCompare(bValue);

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

    return sortDirection === "asc"
      ? " ↑"
      : " ↓";
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

  function toggleMyPick(playerId: string) {
    const alreadyMine =
      myTeamOrder.includes(playerId);

    if (alreadyMine) {
      setMyTeamOrder((current) =>
        current.filter(
          (id) => id !== playerId
        )
      );

      setDraftedIds((current) => {
        const next = new Set(current);
        next.delete(playerId);
        return next;
      });

      return;
    }

    setMyTeamOrder((current) => [
      ...current,
      playerId,
    ]);

    setDraftedIds((current) => {
      const next = new Set(current);
      next.add(playerId);
      return next;
    });
  }

  function getRecommendationReasons(
    player: RankedPlayer
  ) {
    const reasons: string[] = [];

    const categoryStrengths = categoryKeys
      .map((category) => ({
        category,
        zScore: player.zScores[category],
        weight: teamNeedWeights[category],
      }))
      .sort(
        (a, b) =>
          b.zScore * b.weight -
          a.zScore * a.weight
      );

    const eliteCategories =
      categoryStrengths.filter(
        (item) => item.zScore >= 1
      );

    if (eliteCategories.length > 0) {
      const labels = eliteCategories
        .slice(0, 2)
        .map(
          (item) =>
            CATEGORY_LABELS[item.category]
        );

      reasons.push(
        `Strong ${labels.join(" + ")}`
      );
    }

    const neededCategories =
      categoryStrengths.filter(
        (item) =>
          item.weight >= 1.08 &&
          item.zScore > 0.35
      );

    if (neededCategories.length > 0) {
      const labels = neededCategories
        .slice(0, 2)
        .map(
          (item) =>
            CATEGORY_LABELS[item.category]
        );

      reasons.push(
        `Helps ${labels.join(" + ")} need`
      );
    }

    const fillsOpenPosition =
      player.positions.find((position) =>
        openStarterPositions.includes(
          position as
            | "C"
            | "LW"
            | "RW"
            | "D"
        )
      );

    if (fillsOpenPosition) {
      reasons.push(
        `Fills open ${fillsOpenPosition}`
      );
    }

    if (
      player.replacementPosition === "D" &&
      player.vor > 0
    ) {
      reasons.push("D scarcity value");
    }

    if (player.positions.length > 1) {
      reasons.push(
        `${player.positions.join("/")} flexibility`
      );
    }

    if (
      player.needBonus >= 0.2
    ) {
      reasons.push(
        `+${player.needBonus.toFixed(
          2
        )} team-fit boost`
      );
    }

    if (reasons.length === 0) {
      reasons.push("Best overall value");
    }

    return reasons.slice(0, 3);
  }

  const myTeamIdSet = useMemo(
    () => new Set(myTeamOrder),
    [myTeamOrder]
  );

  const positions = [
    "ALL",
    "C",
    "LW",
    "RW",
    "D",
  ];

  const draftedCount = draftedIds.size;

  const availableCount =
    players.length - draftedCount;

  return (
    <main className="min-h-screen bg-zinc-950 p-8 text-white">
      <div className="mx-auto max-w-[1800px]">
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
                  {[
                    8,
                    10,
                    12,
                    14,
                    16,
                    18,
                    20,
                  ].map((teams) => (
                    <option
                      key={teams}
                      value={teams}
                    >
                      {teams}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-6 rounded-xl border border-emerald-900/60 bg-zinc-900 p-5">
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  Live Draft Assistant
                </p>

                <h2 className="mt-1 text-2xl font-bold">
                  Best Available
                </h2>

                <p className="mt-1 text-sm text-zinc-400">
                  Ranked by Nevisly Score using
                  player value, positional scarcity
                  and your current team needs.
                </p>
              </div>

              <div className="grid gap-3 xl:grid-cols-5">
                {bestAvailable.map(
                  (player, index) => {
                    const reasons =
                      getRecommendationReasons(
                        player
                      );

                    return (
                      <div
                        key={player.id}
                        className={`rounded-xl border p-4 ${
                          index === 0
                            ? "border-emerald-600 bg-emerald-950/30"
                            : "border-zinc-800 bg-zinc-950"
                        }`}
                      >
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs font-bold text-zinc-500">
                              #{index + 1}
                            </div>

                            <div className="mt-1 font-semibold">
                              {player.name}
                            </div>

                            <div className="text-xs text-zinc-500">
                              {player.positions.join(
                                "/"
                              )}
                              {" · "}
                              {player.team}
                              {" · Age "}
                              {player.age}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-xs text-zinc-500">
                              Score
                            </div>

                            <div className="text-xl font-bold text-emerald-400">
                              {player.score.toFixed(
                                2
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="mb-3 flex gap-4 text-xs">
                          <div>
                            <span className="text-zinc-500">
                              VOR{" "}
                            </span>
                            <span className="font-semibold">
                              {player.vor.toFixed(
                                2
                              )}
                            </span>
                          </div>

                          <div>
                            <span className="text-zinc-500">
                              Need{" "}
                            </span>

                            <span
                              className={
                                player.needBonus >
                                0
                                  ? "font-semibold text-emerald-400"
                                  : player.needBonus <
                                      0
                                    ? "font-semibold text-red-400"
                                    : "font-semibold"
                              }
                            >
                              {player.needBonus >
                              0
                                ? "+"
                                : ""}
                              {player.needBonus.toFixed(
                                2
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1 text-xs text-zinc-300">
                          {reasons.map(
                            (reason) => (
                              <div
                                key={reason}
                                className="flex gap-2"
                              >
                                <span className="text-emerald-500">
                                  •
                                </span>

                                <span>
                                  {reason}
                                </span>
                              </div>
                            )
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            toggleMyPick(
                              player.id
                            )
                          }
                          className="mt-4 w-full rounded-lg border border-emerald-700 bg-emerald-950/40 px-3 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-950"
                        >
                          My Pick
                        </button>
                      </div>
                    );
                  }
                )}
              </div>
            </div>

            <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="mb-4">
                <h2 className="text-xl font-semibold">
                  My Team
                </h2>

                <p className="text-sm text-zinc-400">
                  {myTeamPlayers.length} skaters drafted
                </p>
              </div>

              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                <TeamStat
                  label="G"
                  value={teamTotals.goals}
                />

                <TeamStat
                  label="A"
                  value={teamTotals.assists}
                />

                <TeamStat
                  label="P"
                  value={teamTotals.points}
                />

                <TeamStat
                  label="PPP"
                  value={teamTotals.ppp}
                />

                <TeamStat
                  label="SOG"
                  value={teamTotals.sog}
                />

                <TeamStat
                  label="HIT"
                  value={teamTotals.hits}
                />

                <TeamStat
                  label="BLK"
                  value={teamTotals.blocks}
                />
              </div>

              {myTeamPlayers.length > 0 && (
                <div className="mb-6">
                  <h3 className="mb-3 font-semibold">
                    Team Needs
                  </h3>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                    {categoryKeys.map(
                      (category) => (
                        <TeamNeedCard
                          key={category}
                          label={
                            CATEGORY_LABELS[
                              category
                            ]
                          }
                          strength={
                            teamCategoryStrength[
                              category
                            ]
                          }
                          weight={
                            teamNeedWeights[
                              category
                            ]
                          }
                        />
                      )
                    )}
                  </div>
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {assignedRoster.map((slot) => (
                  <div
                    key={slot.id}
                    className="rounded-lg border border-zinc-800 bg-zinc-950 p-3"
                  >
                    <div className="mb-1 text-xs font-semibold text-zinc-500">
                      {slot.id}
                    </div>

                    {slot.player ? (
                      <>
                        <div className="font-medium">
                          {slot.player.name}
                        </div>

                        <div className="text-xs text-zinc-500">
                          {slot.player.positions.join(
                            ", "
                          )}
                          {" · "}
                          {slot.player.team}
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-zinc-600">
                        Empty
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-4 flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <input
                  type="text"
                  placeholder="Search player or team..."
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 outline-none placeholder:text-zinc-500 focus:border-zinc-500 md:max-w-md"
                />

                <div className="flex flex-wrap gap-2">
                  {positions.map((position) => {
                    const active =
                      positionFilter ===
                      position;

                    return (
                      <button
                        key={position}
                        type="button"
                        onClick={() =>
                          setPositionFilter(
                            position
                          )
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
                    <th className="p-3">
                      Draft
                    </th>

                    <SortableHeader
                      label="Player"
                      onClick={() =>
                        handleSort("name")
                      }
                      indicator={
                        sortIndicator("name")
                      }
                    />

                    <SortableHeader
                      label="Age"
                      onClick={() =>
                        handleSort("age")
                      }
                      indicator={
                        sortIndicator("age")
                      }
                    />

                    <th className="p-3">
                      Pos
                    </th>

                    <SortableHeader
                      label="Team"
                      onClick={() =>
                        handleSort("team")
                      }
                      indicator={
                        sortIndicator("team")
                      }
                    />

                    <SortableHeader
                      label="Score"
                      onClick={() =>
                        handleSort("score")
                      }
                      indicator={
                        sortIndicator("score")
                      }
                    />

                    <SortableHeader
                      label="VOR"
                      onClick={() =>
                        handleSort("vor")
                      }
                      indicator={
                        sortIndicator("vor")
                      }
                    />

                    <SortableHeader
                      label="Need"
                      onClick={() =>
                        handleSort(
                          "needBonus"
                        )
                      }
                      indicator={
                        sortIndicator(
                          "needBonus"
                        )
                      }
                    />

                    <th className="p-3">
                      VOR Pos
                    </th>

                    <SortableHeader
                      label="GP"
                      onClick={() =>
                        handleSort("gp")
                      }
                      indicator={
                        sortIndicator("gp")
                      }
                    />

                    <SortableHeader
                      label="G"
                      onClick={() =>
                        handleSort("goals")
                      }
                      indicator={
                        sortIndicator("goals")
                      }
                    />

                    <SortableHeader
                      label="A"
                      onClick={() =>
                        handleSort("assists")
                      }
                      indicator={
                        sortIndicator(
                          "assists"
                        )
                      }
                    />

                    <SortableHeader
                      label="P"
                      onClick={() =>
                        handleSort("points")
                      }
                      indicator={
                        sortIndicator(
                          "points"
                        )
                      }
                    />

                    <SortableHeader
                      label="PPP"
                      onClick={() =>
                        handleSort("ppp")
                      }
                      indicator={
                        sortIndicator("ppp")
                      }
                    />

                    <SortableHeader
                      label="SOG"
                      onClick={() =>
                        handleSort("sog")
                      }
                      indicator={
                        sortIndicator("sog")
                      }
                    />

                    <SortableHeader
                      label="HIT"
                      onClick={() =>
                        handleSort("hits")
                      }
                      indicator={
                        sortIndicator("hits")
                      }
                    />

                    <SortableHeader
                      label="BLK"
                      onClick={() =>
                        handleSort("blocks")
                      }
                      indicator={
                        sortIndicator(
                          "blocks"
                        )
                      }
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
                  {filteredPlayers.map(
                    (player) => {
                      const drafted =
                        draftedIds.has(
                          player.id
                        );

                      const myPick =
                        myTeamIdSet.has(
                          player.id
                        );

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
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  toggleDrafted(
                                    player.id
                                  )
                                }
                                disabled={myPick}
                                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {drafted &&
                                !myPick
                                  ? "Undo"
                                  : "Drafted"}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  toggleMyPick(
                                    player.id
                                  )
                                }
                                className={`rounded-lg border px-3 py-1.5 text-xs ${
                                  myPick
                                    ? "border-emerald-600 bg-emerald-950 text-emerald-300"
                                    : "border-zinc-700 bg-zinc-900 hover:border-emerald-700"
                                }`}
                              >
                                {myPick
                                  ? "Remove"
                                  : "My Pick"}
                              </button>
                            </div>
                          </td>

                          <td className="p-3 font-medium">
                            {player.name}
                          </td>

                          <td className="p-3">
                            {player.age}
                          </td>

                          <td className="p-3">
                            {player.positions.join(
                              ", "
                            )}
                          </td>

                          <td className="p-3">
                            {player.team}
                          </td>

                          <td className="p-3 font-bold">
                            {player.score.toFixed(
                              2
                            )}
                          </td>

                          <td className="p-3">
                            {player.vor.toFixed(
                              2
                            )}
                          </td>

                          <td
                            className={`p-3 font-medium ${
                              player.needBonus >
                              0.1
                                ? "text-emerald-400"
                                : player.needBonus <
                                    -0.1
                                  ? "text-red-400"
                                  : "text-zinc-400"
                            }`}
                          >
                            {player.needBonus >
                            0
                              ? "+"
                              : ""}
                            {player.needBonus.toFixed(
                              2
                            )}
                          </td>

                          <td className="p-3 text-zinc-400">
                            {
                              player.replacementPosition
                            }
                          </td>

                          <td className="p-3">
                            {player.gp}
                          </td>

                          <HeatmapCell
                            value={
                              player.goals
                            }
                            zScore={
                              player.zScores
                                .goals
                            }
                          />

                          <HeatmapCell
                            value={
                              player.assists
                            }
                            zScore={
                              player.zScores
                                .assists
                            }
                          />

                          <HeatmapCell
                            value={
                              player.points
                            }
                            zScore={
                              player.zScores
                                .points
                            }
                          />

                          <HeatmapCell
                            value={player.ppp}
                            zScore={
                              player.zScores
                                .ppp
                            }
                          />

                          <HeatmapCell
                            value={player.sog}
                            zScore={
                              player.zScores
                                .sog
                            }
                          />

                          <HeatmapCell
                            value={player.hits}
                            zScore={
                              player.zScores
                                .hits
                            }
                          />

                          <HeatmapCell
                            value={
                              player.blocks
                            }
                            zScore={
                              player.zScores
                                .blocks
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
                    }
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function TeamNeedCard({
  label,
  strength,
  weight,
}: {
  label: string;
  strength: number;
  weight: number;
}) {
  let status = "Balanced";
  let className =
    "border-zinc-700 bg-zinc-950";

  if (weight >= 1.1) {
    status = "Need";
    className =
      "border-red-900 bg-red-950/40";
  } else if (weight <= 0.9) {
    status = "Strong";
    className =
      "border-emerald-900 bg-emerald-950/40";
  }

  return (
    <div
      className={`rounded-lg border p-3 ${className}`}
      title={`Average Z-score: ${strength.toFixed(
        2
      )} · Need weight: ${weight.toFixed(2)}`}
    >
      <div className="text-xs text-zinc-400">
        {label}
      </div>

      <div className="mt-1 font-semibold">
        {status}
      </div>

      <div className="mt-1 text-xs text-zinc-500">
        {weight.toFixed(2)}×
      </div>
    </div>
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
      backgroundColor:
        "rgba(22, 163, 74, 0.70)",
      color: "#ffffff",
    };
  }

  if (zScore >= 1) {
    return {
      backgroundColor:
        "rgba(22, 163, 74, 0.42)",
      color: "#dcfce7",
    };
  }

  if (zScore >= 0.35) {
    return {
      backgroundColor:
        "rgba(22, 163, 74, 0.20)",
    };
  }

  if (zScore > -0.35) {
    return {
      backgroundColor:
        "rgba(113, 113, 122, 0.10)",
    };
  }

  if (zScore > -1) {
    return {
      backgroundColor:
        "rgba(220, 38, 38, 0.18)",
    };
  }

  if (zScore > -2) {
    return {
      backgroundColor:
        "rgba(220, 38, 38, 0.38)",
      color: "#fee2e2",
    };
  }

  return {
    backgroundColor:
      "rgba(220, 38, 38, 0.65)",
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

function TeamStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
      <div className="text-xs text-zinc-500">
        {label}
      </div>

      <div className="mt-1 text-lg font-semibold">
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