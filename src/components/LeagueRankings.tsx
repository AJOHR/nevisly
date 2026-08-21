"use client";

import type { CSSProperties } from "react";

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

type TeamTotals = Record<
  CategoryKey,
  number
>;

type TeamRanks = Record<
  CategoryKey,
  number
>;

type BaseTeamRow = {
  id: string;
  name: string;
  isMyTeam: boolean;
  picks: number;
  totals: TeamTotals;
};

type TeamRow =
  BaseTeamRow & {
    ranks: TeamRanks;

    /*
     * Average category score across
     * every possible H2H opponent.
     *
     * Category win = 1
     * Category tie = 0.5
     * Category loss = 0
     */
    averageCategoriesWon: number;

    /*
     * Percentage of projected H2H
     * matchups won.
     *
     * Matchup win = 1
     * Matchup tie = 0.5
     * Matchup loss = 0
     */
    matchupWinRate: number;

    matchupWins: number;
    matchupTies: number;
    matchupLosses: number;

    overallRank: number;
  };

const categories: {
  key: CategoryKey;
  label: string;
}[] = [
  {
    key: "goals",
    label: "G",
  },
  {
    key: "assists",
    label: "A",
  },
  {
    key: "points",
    label: "P",
  },
  {
    key: "ppp",
    label: "PPP",
  },
  {
    key: "sog",
    label: "SOG",
  },
  {
    key: "hits",
    label: "HIT",
  },
  {
    key: "blocks",
    label: "BLK",
  },
];

const CATEGORY_COUNT =
  categories.length;

function buildTeamTotals(
  players: LeagueSkater[]
): TeamTotals {
  const totals: TeamTotals = {
    goals: 0,
    assists: 0,
    points: 0,
    ppp: 0,
    sog: 0,
    hits: 0,
    blocks: 0,
  };

  for (
    const player of
    players
  ) {
    totals.goals +=
      player.goals;

    totals.assists +=
      player.assists;

    totals.points +=
      player.points;

    totals.ppp +=
      player.ppp;

    totals.sog +=
      player.sog;

    totals.hits +=
      player.hits;

    totals.blocks +=
      player.blocks;
  }

  return totals;
}

/*
 * Compare one team against one opponent
 * over the seven skater categories.
 *
 * Every category contributes:
 *
 * win  = 1
 * tie  = 0.5
 * loss = 0
 *
 * Example:
 *
 * Team A wins 4 categories,
 * loses 3:
 *
 * categoryScore = 4
 */
function compareTeams(
  teamA: TeamTotals,
  teamB: TeamTotals
) {
  let categoryScore =
    0;

  let categoryWins =
    0;

  let categoryTies =
    0;

  let categoryLosses =
    0;

  for (
    const category of
    categories
  ) {
    const a =
      teamA[
        category.key
      ];

    const b =
      teamB[
        category.key
      ];

    if (
      a >
      b
    ) {
      categoryScore +=
        1;

      categoryWins +=
        1;
    } else if (
      a ===
      b
    ) {
      categoryScore +=
        0.5;

      categoryTies +=
        1;
    } else {
      categoryLosses +=
        1;
    }
  }

  /*
   * There are seven categories.
   *
   * > 3.5 = matchup win
   * = 3.5 = matchup tie
   * < 3.5 = matchup loss
   */
  let matchupResult:
    | "WIN"
    | "TIE"
    | "LOSS";

  const halfway =
    CATEGORY_COUNT /
    2;

  if (
    categoryScore >
    halfway
  ) {
    matchupResult =
      "WIN";
  } else if (
    categoryScore ===
    halfway
  ) {
    matchupResult =
      "TIE";
  } else {
    matchupResult =
      "LOSS";
  }

  return {
    categoryScore,
    categoryWins,
    categoryTies,
    categoryLosses,
    matchupResult,
  };
}

export default function LeagueRankings({
  fantasyTeams,
  leagueTeamPlayers,
}: Props) {
  const teamCount =
    fantasyTeams.length;

  /*
   * --------------------------------------------------------
   * BUILD TEAM TOTALS
   * --------------------------------------------------------
   */
  const baseRows:
    BaseTeamRow[] =
    fantasyTeams.map(
      (
        team
      ) => {
        const players =
          leagueTeamPlayers.get(
            team.id
          ) ??
          [];

        return {
          id:
            team.id,

          name:
            team.name,

          isMyTeam:
            team.isMyTeam,

          picks:
            players.length,

          totals:
            buildTeamTotals(
              players
            ),
        };
      }
    );

  /*
   * --------------------------------------------------------
   * CATEGORY RANKS
   * --------------------------------------------------------
   *
   * These are retained for the category
   * matrix / heatmap.
   *
   * They are NOT used as roto points.
   */
  const categoryRanks =
    {} as Record<
      CategoryKey,
      Map<
        string,
        number
      >
    >;

  for (
    const category of
    categories
  ) {
    const sorted =
      [
        ...baseRows,
      ].sort(
        (
          a,
          b
        ) =>
          b.totals[
            category.key
          ] -
          a.totals[
            category.key
          ]
      );

    const result =
      new Map<
        string,
        number
      >();

    let index =
      0;

    while (
      index <
      sorted.length
    ) {
      const currentValue =
        sorted[
          index
        ].totals[
          category.key
        ];

      let tieEnd =
        index;

      while (
        tieEnd +
          1 <
          sorted.length &&
        sorted[
          tieEnd +
            1
        ].totals[
          category.key
        ] ===
          currentValue
      ) {
        tieEnd++;
      }

      const displayedRank =
        index +
        1;

      for (
        let tiedIndex =
          index;
        tiedIndex <=
        tieEnd;
        tiedIndex++
      ) {
        result.set(
          sorted[
            tiedIndex
          ].id,
          displayedRank
        );
      }

      index =
        tieEnd +
        1;
    }

    categoryRanks[
      category.key
    ] =
      result;
  }

  /*
   * --------------------------------------------------------
   * TRUE H2H LEAGUE COMPARISON
   * --------------------------------------------------------
   *
   * Every fantasy team is compared against
   * every other fantasy team.
   */
  const rows: TeamRow[] =
    baseRows.map(
      (
        team
      ) => {
        const ranks =
          {} as TeamRanks;

        for (
          const category of
          categories
        ) {
          ranks[
            category.key
          ] =
            categoryRanks[
              category.key
            ].get(
              team.id
            ) ??
            teamCount;
        }

        let totalCategoryScore =
          0;

        let matchupWins =
          0;

        let matchupTies =
          0;

        let matchupLosses =
          0;

        for (
          const opponent of
          baseRows
        ) {
          if (
            opponent.id ===
            team.id
          ) {
            continue;
          }

          const result =
            compareTeams(
              team.totals,
              opponent.totals
            );

          totalCategoryScore +=
            result.categoryScore;

          if (
            result.matchupResult ===
            "WIN"
          ) {
            matchupWins++;
          } else if (
            result.matchupResult ===
            "TIE"
          ) {
            matchupTies++;
          } else {
            matchupLosses++;
          }
        }

        const opponentCount =
          Math.max(
            0,
            teamCount -
              1
          );

        const averageCategoriesWon =
          opponentCount >
          0
            ? totalCategoryScore /
              opponentCount
            : 0;

        const matchupWinRate =
          opponentCount >
          0
            ? (
                matchupWins +
                matchupTies *
                  0.5
              ) /
              opponentCount
            : 0;

        return {
          ...team,

          ranks,

          averageCategoriesWon,

          matchupWinRate,

          matchupWins,

          matchupTies,

          matchupLosses,

          overallRank:
            0,
        };
      }
    );

  /*
   * --------------------------------------------------------
   * H2H RANKING
   * --------------------------------------------------------
   *
   * Primary:
   * matchup win rate
   *
   * Tiebreak:
   * average categories won
   */
  const sortedRows =
    [
      ...rows,
    ].sort(
      (
        a,
        b
      ) => {
        if (
          b.matchupWinRate !==
          a.matchupWinRate
        ) {
          return (
            b.matchupWinRate -
            a.matchupWinRate
          );
        }

        if (
          b.averageCategoriesWon !==
          a.averageCategoriesWon
        ) {
          return (
            b.averageCategoriesWon -
            a.averageCategoriesWon
          );
        }

        /*
         * During the draft, one team can
         * temporarily have one extra player.
         *
         * Do not use picks as a positive
         * ranking tiebreaker.
         */
        return a.name.localeCompare(
          b.name
        );
      }
    );

  sortedRows.forEach(
    (
      team,
      index
    ) => {
      team.overallRank =
        index +
        1;
    }
  );

  const myTeam =
    sortedRows.find(
      (
        team
      ) =>
        team.isMyTeam
    );

  return (
    <div className="mb-6 rounded-xl border border-violet-900/60 bg-zinc-900 p-5">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-400">
            Live League Intelligence
          </p>

          <h2 className="mt-1 text-2xl font-bold">
            H2H League Rankings
          </h2>

          <p className="mt-1 text-sm text-zinc-400">
            Projected H2H strength using the skaters drafted so far.
          </p>
        </div>

        {myTeam && (
          <div className="rounded-xl border border-violet-800 bg-violet-950/30 px-5 py-3">
            <div className="text-xs text-zinc-400">
              My Team
            </div>

            <div className="mt-1 flex flex-wrap items-end gap-x-4 gap-y-1">
              <span className="text-2xl font-bold">
                #
                {
                  myTeam.overallRank
                }
              </span>

              <span className="pb-1 text-sm text-violet-300">
                {(
                  myTeam.matchupWinRate *
                  100
                ).toFixed(
                  0
                )}
                % win rate
              </span>

              <span className="pb-1 text-sm text-zinc-400">
                {myTeam.averageCategoriesWon.toFixed(
                  2
                )}
                /7 cats
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-zinc-400">
              <th className="p-3">
                Rank
              </th>

              <th className="p-3">
                Team
              </th>

              <th className="p-3 text-center">
                Picks
              </th>

              <th className="p-3 text-center">
                Avg Cats
              </th>

              <th className="p-3 text-center">
                H2H Win %
              </th>

              <th className="p-3 text-center">
                Record
              </th>

              {categories.map(
                (
                  category
                ) => (
                  <th
                    key={
                      category.key
                    }
                    className="p-3 text-center"
                  >
                    {
                      category.label
                    }
                  </th>
                )
              )}
            </tr>
          </thead>

          <tbody>
            {sortedRows.map(
              (
                team
              ) => (
                <tr
                  key={
                    team.id
                  }
                  className={`border-b border-zinc-800/70 ${
                    team.isMyTeam
                      ? "bg-violet-950/20"
                      : ""
                  }`}
                >
                  <td className="p-3">
                    <span
                      className={`font-bold ${
                        team.overallRank ===
                        1
                          ? "text-amber-400"
                          : team.isMyTeam
                            ? "text-violet-300"
                            : ""
                      }`}
                    >
                      #
                      {
                        team.overallRank
                      }
                    </span>
                  </td>

                  <td className="p-3">
                    <div className="font-semibold">
                      {
                        team.name
                      }
                    </div>

                    {team.isMyTeam && (
                      <div className="text-xs text-violet-400">
                        You
                      </div>
                    )}
                  </td>

                  <td className="p-3 text-center text-zinc-400">
                    {
                      team.picks
                    }
                  </td>

                  <td className="p-3 text-center font-bold">
                    {team.averageCategoriesWon.toFixed(
                      2
                    )}
                    /7
                  </td>

                  <td className="p-3 text-center">
                    <WinRateBadge
                      winRate={
                        team.matchupWinRate
                      }
                    />
                  </td>

                  <td className="p-3 text-center text-xs text-zinc-400">
                    {
                      team.matchupWins
                    }
                    -
                    {
                      team.matchupLosses
                    }

                    {team.matchupTies >
                      0 && (
                      <>
                        -
                        {
                          team.matchupTies
                        }
                      </>
                    )}
                  </td>

                  {categories.map(
                    (
                      category
                    ) => (
                      <CategoryCell
                        key={
                          category.key
                        }
                        total={
                          team.totals[
                            category.key
                          ]
                        }
                        rank={
                          team.ranks[
                            category.key
                          ]
                        }
                        teamCount={
                          teamCount
                        }
                      />
                    )
                  )}
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-500">
        <span>
          H2H Win % = projected matchup wins vs every opponent
        </span>

        <span>
          Avg Cats = average category score out of 7
        </span>

        <span>
          Category win = 1 · tie = 0.5
        </span>

        <span>
          Cell number = projected category total
        </span>

        <span>
          Small label = category rank
        </span>

        <span>
          Green = league strength
        </span>

        <span>
          Red = league weakness
        </span>
      </div>
    </div>
  );
}

function WinRateBadge({
  winRate,
}: {
  winRate: number;
}) {
  const percentage =
    Math.round(
      winRate *
        100
    );

  let className =
    "border-zinc-700 bg-zinc-950 text-zinc-300";

  if (
    winRate >=
    0.7
  ) {
    className =
      "border-emerald-800 bg-emerald-950/40 text-emerald-300";
  } else if (
    winRate >=
    0.55
  ) {
    className =
      "border-green-900 bg-green-950/25 text-green-300";
  } else if (
    winRate <
    0.35
  ) {
    className =
      "border-red-900 bg-red-950/40 text-red-300";
  } else if (
    winRate <
    0.5
  ) {
    className =
      "border-orange-900 bg-orange-950/30 text-orange-300";
  }

  return (
    <span
      className={`inline-flex min-w-[58px] justify-center rounded-md border px-2 py-1 text-xs font-bold ${className}`}
    >
      {
        percentage
      }
      %
    </span>
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
      style={getLeagueHeatmapStyle(
        rank,
        teamCount
      )}
    >
      <div className="font-semibold">
        {
          total
        }
      </div>

      <div className="mt-0.5 text-[10px] opacity-70">
        #
        {
          rank
        }
      </div>
    </td>
  );
}

function getLeagueHeatmapStyle(
  rank: number,
  teamCount: number
): CSSProperties {
  if (
    teamCount <=
    1
  ) {
    return {};
  }

  const percentile =
    1 -
    (
      rank -
      1
    ) /
      (
        teamCount -
        1
      );

  if (
    percentile >=
    0.85
  ) {
    return {
      backgroundColor:
        "rgba(22, 163, 74, 0.55)",
      color:
        "#ffffff",
    };
  }

  if (
    percentile >=
    0.65
  ) {
    return {
      backgroundColor:
        "rgba(22, 163, 74, 0.25)",
    };
  }

  if (
    percentile >=
    0.4
  ) {
    return {
      backgroundColor:
        "rgba(113, 113, 122, 0.10)",
    };
  }

  if (
    percentile >=
    0.2
  ) {
    return {
      backgroundColor:
        "rgba(220, 38, 38, 0.22)",
    };
  }

  return {
    backgroundColor:
      "rgba(220, 38, 38, 0.48)",
    color:
      "#ffffff",
  };
}