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

type TeamTotals = Record<CategoryKey, number>;
type TeamRanks = Record<CategoryKey, number>;

type BaseTeamRow = {
  id: string;
  name: string;
  isMyTeam: boolean;
  picks: number;

  /*
   * Actual drafted totals.
   *
   * These are what the UI displays.
   */
  totals: TeamTotals;

  /*
   * Per-pick category production.
   *
   * These are used only for normalized
   * H2H comparisons while teams have
   * unequal pick counts.
   */
  perPickTotals: TeamTotals;
};

type TeamRow = BaseTeamRow & {
  ranks: TeamRanks;

  averageCategoriesWon: number;
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

function createEmptyTotals(): TeamTotals {
  return {
    goals: 0,
    assists: 0,
    points: 0,
    ppp: 0,
    sog: 0,
    hits: 0,
    blocks: 0,
  };
}

function buildTeamTotals(
  players: LeagueSkater[]
): TeamTotals {
  const totals =
    createEmptyTotals();

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

function buildPerPickTotals(
  totals: TeamTotals,
  picks: number
): TeamTotals {
  if (
    picks <=
    0
  ) {
    return createEmptyTotals();
  }

  const result =
    createEmptyTotals();

  for (
    const category of
    categories
  ) {
    result[
      category.key
    ] =
      totals[
        category.key
      ] /
      picks;
  }

  return result;
}

/*
 * Produce fair comparison totals for two
 * teams that may temporarily have different
 * numbers of drafted players.
 *
 * Example:
 *
 * Team A has 5 picks
 * Team B has 4 picks
 *
 * Both are compared at 4 picks worth
 * of production.
 *
 * We use each team's per-pick production
 * multiplied by the smaller pick count.
 *
 * This removes the temporary snake-draft
 * advantage from having one extra player.
 */
function buildNormalizedMatchupTotals(
  teamA: BaseTeamRow,
  teamB: BaseTeamRow
) {
  const comparablePicks =
    Math.min(
      teamA.picks,
      teamB.picks
    );

  const teamATotals =
    createEmptyTotals();

  const teamBTotals =
    createEmptyTotals();

  /*
   * If either team has no players yet,
   * there is not enough information for
   * a meaningful H2H comparison.
   */
  if (
    comparablePicks <=
    0
  ) {
    return {
      teamATotals,
      teamBTotals,
      comparablePicks,
      valid:
        false,
    };
  }

  for (
    const category of
    categories
  ) {
    teamATotals[
      category.key
    ] =
      teamA.perPickTotals[
        category.key
      ] *
      comparablePicks;

    teamBTotals[
      category.key
    ] =
      teamB.perPickTotals[
        category.key
      ] *
      comparablePicks;
  }

  return {
    teamATotals,
    teamBTotals,
    comparablePicks,
    valid:
      true,
  };
}

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

        const totals =
          buildTeamTotals(
            players
          );

        return {
          id:
            team.id,

          name:
            team.name,

          isMyTeam:
            team.isMyTeam,

          picks:
            players.length,

          totals,

          perPickTotals:
            buildPerPickTotals(
              totals,
              players.length
            ),
        };
      }
    );

  /*
   * --------------------------------------------------------
   * CATEGORY RANKS
   * --------------------------------------------------------
   *
   * Visible category cells still use actual
   * drafted totals.
   *
   * This keeps the matrix intuitive:
   * what you see is what each team has drafted.
   */
  const categoryRanks =
    {} as Record<
      CategoryKey,
      Map<string, number>
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
   * NORMALIZED H2H LEAGUE COMPARISON
   * --------------------------------------------------------
   *
   * H2H comparisons use equalized pick counts.
   *
   * If:
   *
   * Team A = 5 picks
   * Team B = 4 picks
   *
   * both teams are compared as if they had
   * 4 picks.
   *
   * Actual visible totals are NOT changed.
   */
  const rows:
    TeamRow[] =
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

        let validOpponentCount =
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

          const normalized =
            buildNormalizedMatchupTotals(
              team,
              opponent
            );

          if (
            !normalized.valid
          ) {
            continue;
          }

          const result =
            compareTeams(
              normalized.teamATotals,
              normalized.teamBTotals
            );

          validOpponentCount++;

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

        const averageCategoriesWon =
          validOpponentCount >
          0
            ? totalCategoryScore /
              validOpponentCount
            : 0;

        const matchupWinRate =
          validOpponentCount >
          0
            ? (
                matchupWins +
                matchupTies *
                  0.5
              ) /
              validOpponentCount
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
   * normalized matchup win rate
   *
   * Secondary:
   * normalized average categories won
   */
  const sortedRows =
    [
      ...rows,
    ].sort(
      (
        a,
        b
      ) => {
        /*
         * Teams with zero players should not
         * rank above teams that have begun
         * drafting.
         */
        if (
          a.picks ===
            0 &&
          b.picks >
            0
        ) {
          return 1;
        }

        if (
          b.picks ===
            0 &&
          a.picks >
            0
        ) {
          return -1;
        }

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

        return a.name.localeCompare(
          b.name
        );
      }
    );

  /*
   * Preserve tied H2H ranks.
   *
   * Example:
   *
   * #1
   * #1
   * #3
   *
   * instead of arbitrarily calling
   * equivalent teams #1 and #2.
   */
  let previousTeam:
    TeamRow |
    undefined;

  let previousRank =
    0;

  sortedRows.forEach(
    (
      team,
      index
    ) => {
      const tiedWithPrevious =
        previousTeam !==
          undefined &&
        team.picks >
          0 &&
        previousTeam.picks >
          0 &&
        team.matchupWinRate ===
          previousTeam.matchupWinRate &&
        team.averageCategoriesWon ===
          previousTeam.averageCategoriesWon;

      if (
        tiedWithPrevious
      ) {
        team.overallRank =
          previousRank;
      } else {
        team.overallRank =
          index +
          1;

        previousRank =
          team.overallRank;
      }

      previousTeam =
        team;
    }
  );

  const myTeam =
    sortedRows.find(
      (
        team
      ) =>
        team.isMyTeam
    );

  const activeTeamCount =
    baseRows.filter(
      (
        team
      ) =>
        team.picks >
        0
    ).length;

  const rankingsAreEarly =
    activeTeamCount <
    teamCount;

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
            Projected H2H strength normalized for unequal pick counts.
          </p>

          {rankingsAreEarly && (
            <p className="mt-1 text-xs text-zinc-600">
              Rankings become more reliable once every team has drafted at least one skater.
            </p>
          )}
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
                    {team.picks >
                    0
                      ? `${team.averageCategoriesWon.toFixed(
                          2
                        )}/7`
                      : "—"}
                  </td>

                  <td className="p-3 text-center">
                    {team.picks >
                    0 ? (
                      <WinRateBadge
                        winRate={
                          team.matchupWinRate
                        }
                      />
                    ) : (
                      <span className="text-zinc-700">
                        —
                      </span>
                    )}
                  </td>

                  <td className="p-3 text-center text-xs text-zinc-400">
                    {team.picks >
                    0 ? (
                      <>
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
                      </>
                    ) : (
                      "—"
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
          H2H metrics are normalized to equal pick counts
        </span>

        <span>
          Visible category totals remain actual drafted totals
        </span>

        <span>
          H2H Win % = projected matchup wins vs opponents
        </span>

        <span>
          Avg Cats = average category score out of 7
        </span>

        <span>
          Category win = 1 · tie = 0.5
        </span>

        <span>
          Small category label = raw-total rank
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
      "rgba(220, 38, 38,0.48)",
    color:
      "#ffffff",
  };
}