"use client";

type CategoryKey =
  | "goals"
  | "assists"
  | "points"
  | "ppp"
  | "sog"
  | "hits"
  | "blocks";

type LeagueSkater = {
  id: string;
  name: string;
  goals: number;
  assists: number;
  points: number;
  ppp: number;
  sog: number;
  hits: number;
  blocks: number;
};

type FantasyTeam = {
  id: string;
  name: string;
  isMyTeam: boolean;
};

type Props = {
  fantasyTeams: FantasyTeam[];
  leagueTeamPlayers: Map<string, LeagueSkater[]>;
};

type TeamTotals = Record<CategoryKey, number>;
type TeamRanks = Record<CategoryKey, number>;
type TeamRotoPoints = Record<CategoryKey, number>;

type TeamRow = {
  id: string;
  name: string;
  isMyTeam: boolean;
  picks: number;
  totals: TeamTotals;
  ranks: TeamRanks;
  rotoPoints: TeamRotoPoints;
  overallPoints: number;
  overallRank: number;
};

const categories: {
  key: CategoryKey;
  label: string;
}[] = [
  { key: "goals", label: "G" },
  { key: "assists", label: "A" },
  { key: "points", label: "P" },
  { key: "ppp", label: "PPP" },
  { key: "sog", label: "SOG" },
  { key: "hits", label: "HIT" },
  { key: "blocks", label: "BLK" },
];

export default function LeagueRankings({
  fantasyTeams,
  leagueTeamPlayers,
}: Props) {
  const teamCount = fantasyTeams.length;

  const baseRows = fantasyTeams.map((team) => {
    const players = leagueTeamPlayers.get(team.id) ?? [];

    const totals: TeamTotals = {
      goals: 0,
      assists: 0,
      points: 0,
      ppp: 0,
      sog: 0,
      hits: 0,
      blocks: 0,
    };

    for (const player of players) {
      totals.goals += player.goals;
      totals.assists += player.assists;
      totals.points += player.points;
      totals.ppp += player.ppp;
      totals.sog += player.sog;
      totals.hits += player.hits;
      totals.blocks += player.blocks;
    }

    return {
      id: team.id,
      name: team.name,
      isMyTeam: team.isMyTeam,
      picks: players.length,
      totals,
    };
  });

  const categoryResults = {} as Record<
    CategoryKey,
    Map<string, { rank: number; rotoPoints: number }>
  >;

  for (const category of categories) {
    const sorted = [...baseRows].sort(
      (a, b) =>
        b.totals[category.key] -
        a.totals[category.key]
    );

    const result = new Map<
      string,
      { rank: number; rotoPoints: number }
    >();

    let index = 0;

    while (index < sorted.length) {
      const currentValue =
        sorted[index].totals[category.key];

      let tieEnd = index;

      while (
        tieEnd + 1 < sorted.length &&
        sorted[tieEnd + 1].totals[category.key] ===
          currentValue
      ) {
        tieEnd++;
      }

      let totalAvailablePoints = 0;

      for (
        let tiedIndex = index;
        tiedIndex <= tieEnd;
        tiedIndex++
      ) {
        totalAvailablePoints +=
          teamCount - tiedIndex;
      }

      const averagePoints =
        totalAvailablePoints /
        (tieEnd - index + 1);

      const displayedRank = index + 1;

      for (
        let tiedIndex = index;
        tiedIndex <= tieEnd;
        tiedIndex++
      ) {
        result.set(sorted[tiedIndex].id, {
          rank: displayedRank,
          rotoPoints: averagePoints,
        });
      }

      index = tieEnd + 1;
    }

    categoryResults[category.key] = result;
  }

  const rows: TeamRow[] = baseRows.map((team) => {
    const ranks = {} as TeamRanks;
    const rotoPoints = {} as TeamRotoPoints;

    let overallPoints = 0;

    for (const category of categories) {
      const result =
        categoryResults[category.key].get(team.id);

      ranks[category.key] =
        result?.rank ?? teamCount;

      rotoPoints[category.key] =
        result?.rotoPoints ?? 1;

      overallPoints +=
        result?.rotoPoints ?? 1;
    }

    return {
      ...team,
      ranks,
      rotoPoints,
      overallPoints,
      overallRank: 0,
    };
  });

  const sortedRows = [...rows].sort(
    (a, b) =>
      b.overallPoints - a.overallPoints
  );

  sortedRows.forEach((team, index) => {
    team.overallRank = index + 1;
  });

  const myTeam = sortedRows.find(
    (team) => team.isMyTeam
  );

  return (
    <div className="mb-6 rounded-xl border border-violet-900/60 bg-zinc-900 p-5">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-400">
            Live League Intelligence
          </p>

          <h2 className="mt-1 text-2xl font-bold">
            League Rankings
          </h2>

          <p className="mt-1 text-sm text-zinc-400">
            Projected standings using the skaters drafted so far.
          </p>
        </div>

        {myTeam && (
          <div className="rounded-xl border border-violet-800 bg-violet-950/30 px-5 py-3">
            <div className="text-xs text-zinc-400">
              My Team
            </div>

            <div className="mt-1 flex items-end gap-3">
              <span className="text-2xl font-bold">
                #{myTeam.overallRank}
              </span>

              <span className="pb-1 text-sm text-violet-300">
                {myTeam.overallPoints.toFixed(1)} pts
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[950px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-zinc-400">
              <th className="p-3">Rank</th>
              <th className="p-3">Team</th>
              <th className="p-3 text-center">Picks</th>
              <th className="p-3 text-center">Roto Pts</th>

              {categories.map((category) => (
                <th
                  key={category.key}
                  className="p-3 text-center"
                >
                  {category.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {sortedRows.map((team) => (
              <tr
                key={team.id}
                className={`border-b border-zinc-800/70 ${
                  team.isMyTeam
                    ? "bg-violet-950/20"
                    : ""
                }`}
              >
                <td className="p-3">
                  <span
                    className={`font-bold ${
                      team.overallRank === 1
                        ? "text-amber-400"
                        : team.isMyTeam
                          ? "text-violet-300"
                          : ""
                    }`}
                  >
                    #{team.overallRank}
                  </span>
                </td>

                <td className="p-3">
                  <div className="font-semibold">
                    {team.name}
                  </div>

                  {team.isMyTeam && (
                    <div className="text-xs text-violet-400">
                      You
                    </div>
                  )}
                </td>

                <td className="p-3 text-center text-zinc-400">
                  {team.picks}
                </td>

                <td className="p-3 text-center font-bold">
                  {team.overallPoints.toFixed(1)}
                </td>

                {categories.map((category) => (
                  <CategoryCell
                    key={category.key}
                    total={team.totals[category.key]}
                    rank={team.ranks[category.key]}
                    teamCount={teamCount}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-500">
        <span>Cell number = projected category total</span>
        <span>Small label = category rank</span>
        <span>Green = league strength</span>
        <span>Red = league weakness</span>
      </div>
    </div>
  );
}

function CategoryCell({
  total,
  rank,
  teamCount,
}: {
  total: number;
  rank: number;
  teamCount: number;
}) {
  return (
    <td
      className="p-3 text-center"
      style={getLeagueHeatmapStyle(rank, teamCount)}
    >
      <div className="font-semibold">
        {total}
      </div>

      <div className="mt-0.5 text-[10px] opacity-70">
        #{rank}
      </div>
    </td>
  );
}

function getLeagueHeatmapStyle(
  rank: number,
  teamCount: number
): React.CSSProperties {
  if (teamCount <= 1) {
    return {};
  }

  const percentile =
    1 - (rank - 1) / (teamCount - 1);

  if (percentile >= 0.85) {
    return {
      backgroundColor: "rgba(22, 163, 74, 0.55)",
      color: "#ffffff",
    };
  }

  if (percentile >= 0.65) {
    return {
      backgroundColor: "rgba(22, 163, 74, 0.25)",
    };
  }

  if (percentile >= 0.4) {
    return {
      backgroundColor: "rgba(113, 113, 122, 0.10)",
    };
  }

  if (percentile >= 0.2) {
    return {
      backgroundColor: "rgba(220, 38, 38, 0.22)",
    };
  }

  return {
    backgroundColor: "rgba(220, 38, 38, 0.48)",
    color: "#ffffff",
  };
}