"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ChangeEvent,
} from "react";

import { parseSkaterCsv } from "@/lib/projections/parseSkaterCsv";

import PlayerExplanationCard from "@/components/PlayerExplanationCard";

import {
    blendSkaterProjections,
    getProjectionDiagnostics,
    type ProjectionSource,
  } from "@/lib/projections/blendSkaterProjections";

import type { SkaterProjection } from "@/types/player";
import type { DraftPick, FantasyTeam } from "@/types/draft";

import LeagueRankings from "@/components/LeagueRankings";

import NevislyLegend from "@/components/NevislyLegend";

import { calculateH2HImpact } from "@/lib/draft/h2hImpact";
import { calculateDraftRoomScarcity } from "@/lib/draft/draftRoomScarcity";

import {
  calculateScheduleBonus,
  type PlayoffScheduleMap,
} from "@/lib/draft/playoffSchedule";

import {
  calculateReturnRisk,
  type ReturnRiskLevel,
} from "@/lib/draft/returnRisk";

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

type ProjectionSourceState = {
  id: string;
  name: string;
  weight: number;
  fileName: string;
  players: SkaterProjection[];
};

const [
    injuries,
    setInjuries,
  ] = useState<InjuryStatus[]>([]);

type InjuryStatus = {
    id: string;
    name: string;
    team: string;
    status: string;
    injuryType: string | null;
    returnDate: string | null;
  };

export type BaseRankedPlayer = SkaterProjection & {
    rawScore: number;
    vor: number;
    replacementPosition: string;
    zScores: Record<CategoryKey, number>;
  
    projectionSources?: number;
    projectionConfidence?: "HIGH" | "MEDIUM" | "LOW";
    projectionVariance?: number;
  };

export type RankedPlayer = BaseRankedPlayer & {
  needBonus: number;

  h2hGain: number;

  scarcityBonus: number;
  scarcityReasons: string[];

  returnRisk: ReturnRiskLevel;
  returnProbability: number;
  returnReason: string;
  picksUntilNext: number;

  seasonOffNightGames: number;

  playoffGames: number;
  playoffOffNightGames: number;

  playoffWeekGames: [
    number,
    number,
    number
  ];

  playoffWeekOffNights: [
    number,
    number,
    number
  ];

  scheduleBonus: number;



  projectionSources?: number;

  projectionConfidence?: 

    "HIGH" |

    "MEDIUM" |

    "LOW";

  projectionVariance?: number;

  score: number;
};

type SortKey =
  | "name"
  | "age"
  | "team"
  | "score"
  | "gp"
  | "playoffGames"
  | "seasonOffNightGames"
  | "goals"
  | "assists"
  | "points"
  | "ppp"
  | "sog"
  | "hits"
  | "blocks";

type SortDirection =
  | "asc"
  | "desc";

type RosterSlot = {
  id: string;

  position:
    | "C"
    | "LW"
    | "RW"
    | "D"
    | "BN";

  player?: RankedPlayer;
};

const STARTERS_PER_TEAM: Record<
  string,
  number
> = {
  C: 2,
  LW: 2,
  RW: 2,
  D: 4,
};

const STARTING_SLOTS = [
  {
    id: "C1",
    position: "C",
  },
  {
    id: "C2",
    position: "C",
  },
  {
    id: "LW1",
    position: "LW",
  },
  {
    id: "LW2",
    position: "LW",
  },
  {
    id: "RW1",
    position: "RW",
  },
  {
    id: "RW2",
    position: "RW",
  },
  {
    id: "D1",
    position: "D",
  },
  {
    id: "D2",
    position: "D",
  },
  {
    id: "D3",
    position: "D",
  },
  {
    id: "D4",
    position: "D",
  },
] as const;

const BENCH_COUNT =
  4;

const SCHEDULE_TEAM_ALIASES: Record<
  string,
  string
> = {
  TB: "TBL",
  LA: "LAK",
  NJ: "NJD",
  SJ: "SJS",
  WAS: "WSH",
  CLB: "CBJ",
  MON: "MTL",
};

function createProjectionSource(
  number: number,
  weight = 0
): ProjectionSourceState {
  return {
    id: `projection-source-${Date.now()}-${number}-${Math.random()
      .toString(36)
      .slice(2)}`,

    name:
      number === 1
        ? "Primary Projection"
        : `Projection Source ${number}`,

    weight,

    fileName: "",

    players: [],
  };
}

function getMyTeamId(
  draftSlot: number
) {
  return `team-${draftSlot}`;
}

function getSnakeTeamIdForPick(
  pickNumber: number,
  teamCount: number
) {
  const roundIndex =
    Math.floor(
      (pickNumber - 1) /
        teamCount
    );

  const positionInRound =
    (pickNumber - 1) %
    teamCount;

  const teamNumber =
    roundIndex % 2 ===
    0
      ? positionInRound +
        1
      : teamCount -
        positionInRound;

  return `team-${teamNumber}`;
}

function calculateAgeRiskBonus(
  age: number
) {
  if (
    age <=
    31
  ) {
    return 0;
  }

  if (
    age <=
    34
  ) {
    return -0.03;
  }

  if (
    age <=
    36
  ) {
    return -0.07;
  }

  if (
    age <=
    38
  ) {
    return -0.12;
  }

  return -0.18;
}

function getTeamSchedule(
  schedule:
    PlayoffScheduleMap,
  team: string
) {
  const normalized =
    team
      .trim()
      .toUpperCase();

  const direct =
    schedule[
      normalized
    ];

  if (
    direct
  ) {
    return direct;
  }

  const alias =
    SCHEDULE_TEAM_ALIASES[
      normalized
    ];

  if (
    alias
  ) {
    return schedule[
      alias
    ];
  }

  return undefined;
}

export default function ProjectionUpload() {
  const [
    projectionSources,
    setProjectionSources,
  ] =
    useState<
      ProjectionSourceState[]
    >([
      createProjectionSource(
        1,
        100
      ),
    ]);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    positionFilter,
    setPositionFilter,
  ] =
    useState("ALL");

  const [
    sortKey,
    setSortKey,
  ] =
    useState<SortKey>(
      "score"
    );

  const [
    sortDirection,
    setSortDirection,
  ] =
    useState<SortDirection>(
      "desc"
    );

  const [
    showDrafted,
    setShowDrafted,
  ] =
    useState(false);

  const [
    leagueTeams,
    setLeagueTeams,
  ] =
    useState(12);

  const [
    myDraftSlot,
    setMyDraftSlot,
  ] =
    useState(1);

  const [
    draftPicks,
    setDraftPicks,
  ] =
    useState<
      DraftPick[]
    >([]);

    const [
        selectedPlayer,
        setSelectedPlayer,
      ] = useState<RankedPlayer | null>(null);

  const [
    selectedDraftTeamId,
    setSelectedDraftTeamId,
  ] =
    useState(
      "team-1"
    );

  const [
    playoffSchedule,
    setPlayoffSchedule,
  ] =
    useState<
      PlayoffScheduleMap
    >({});

  const myTeamId =
    getMyTeamId(
      myDraftSlot
    );

  /*
   * --------------------------------------------------------
   * PROJECTION BLENDING
   * --------------------------------------------------------
   */

  const activeProjectionSources =
    useMemo(() => {
      return projectionSources.filter(
        (
          source
        ) =>
          source.players.length >
            0 &&
          source.weight >
            0
      );
    }, [
      projectionSources,
    ]);

    const projectionDiagnostics =
    useMemo(() => {
      const sources:
        ProjectionSource[] =
        activeProjectionSources.map(
          (
            source
          ) => ({
            id:
              source.id,
  
            name:
              source.name,
  
            weight:
              source.weight,
  
            players:
              source.players,
          })
        );
  
      return getProjectionDiagnostics(
        sources
      );
    }, [
      activeProjectionSources,
    ]);

  const players =
    useMemo(() => {
      const sources:
        ProjectionSource[] =
        activeProjectionSources.map(
          (
            source
          ) => ({
            id:
              source.id,

            name:
              source.name,

            weight:
              source.weight,

            players:
              source.players,
          })
        );

      return blendSkaterProjections(
        sources
      ); 
    }, [
      activeProjectionSources,
    ]);

  const totalProjectionWeight =
    useMemo(() => {
      return projectionSources.reduce(
        (
          total,
          source
        ) =>
          total +
          Math.max(
            0,
            source.weight
          ),
        0
      );
    }, [
      projectionSources,
    ]);

  const loadedSourceCount =
    projectionSources.filter(
      (
        source
      ) =>
        source.players.length >
        0
    ).length;

  function resetDraftForProjectionChange() {
    setDraftPicks(
      []
    );

    setSelectedDraftTeamId(
      myTeamId
    );
  }

  async function handleProjectionFile(
    sourceId: string,
    event:
      ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target
        .files?.[0];

    if (
      !file
    ) {
      return;
    }

    try {
      setError("");

      const parsedPlayers =
        await parseSkaterCsv(
          file
        );

      if (
        parsedPlayers.length ===
        0
      ) {
        setError(
          `No skater projections were found in ${file.name}.`
        );

        return;
      }

      setProjectionSources(
        (
          current
        ) =>
          current.map(
            (
              source
            ) =>
              source.id ===
              sourceId
                ? {
                    ...source,

                    fileName:
                      file.name,

                    players:
                      parsedPlayers,
                  }
                : source
          )
      );

      resetDraftForProjectionChange();
    } catch {
      setError(
        `Could not read ${file.name}.`
      );
    }
  }

  function handleProjectionNameChange(
    sourceId: string,
    name: string
  ) {
    setProjectionSources(
      (
        current
      ) =>
        current.map(
          (
            source
          ) =>
            source.id ===
            sourceId
              ? {
                  ...source,
                  name,
                }
              : source
        )
    );
  }

  function handleProjectionWeightChange(
    sourceId: string,
    weight: number
  ) {
    const safeWeight =
      Number.isFinite(
        weight
      )
        ? Math.max(
            0,
            weight
          )
        : 0;

    setProjectionSources(
      (
        current
      ) =>
        current.map(
          (
            source
          ) =>
            source.id ===
            sourceId
              ? {
                  ...source,
                  weight:
                    safeWeight,
                }
              : source
        )
    );

    resetDraftForProjectionChange();
  }

  function addProjectionSource() {
    setProjectionSources(
      (
        current
      ) => [
        ...current,

        createProjectionSource(
          current.length +
            1,
          0
        ),
      ]
    );
  }
 
  function normalizePlayerName(
    name: string
  ) {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .replace(
        /[^a-z0-9]/g,
        ""
      );
  }

  const injuryByPlayer =
  useMemo(() => {
    const map =
      new Map<
        string,
        InjuryStatus
      >();

    for (
      const injury of
      injuries
    ) {
      const key =
        `${normalizePlayerName(
          injury.name
        )}|${injury.team
          .trim()
          .toUpperCase()}`;

      map.set(
        key,
        injury
      );
    }

    return map;
  }, [
    injuries,
  ]);

  function removeProjectionSource(
    sourceId: string
  ) {
    setProjectionSources(
      (
        current
      ) => {
        if (
          current.length <=
          1
        ) {
          return current;
        }

        return current.filter(
          (
            source
          ) =>
            source.id !==
            sourceId
        );
      }
    );

    resetDraftForProjectionChange();
  }

  useEffect(() => {
    async function loadInjuries() {
      try {
        const response =
          await fetch(
            "/api/nhl/injuries"
          );
  
        if (
          !response.ok
        ) {
          return;
        }
  
        const data =
          await response.json();
  
        setInjuries(
          data.injuries ??
            []
        );
      } catch {
        /*
         * Injury status is supplemental.
         */
      }
    }
  
    loadInjuries();
  }, []);

  useEffect(() => {
    async function loadSchedule() {
      try {
        const response =
          await fetch(
            "/api/nhl/playoff-schedule"
          );

        if (
          !response.ok
        ) {
          return;
        }

        const data =
          await response.json();

        setPlayoffSchedule(
          data.teams ??
            {}
        );
      } catch {
        /*
         * Schedule is supplemental.
         */
      }
    }

    loadSchedule();
  }, []);

  const fantasyTeams =
    useMemo<
      FantasyTeam[]
    >(() => {
      return Array.from(
        {
          length:
            leagueTeams,
        },
        (
          _,
          index
        ) => {
          const teamNumber =
            index +
            1;

          return {
            id:
              `team-${teamNumber}`,

            name:
              teamNumber ===
              myDraftSlot
                ? "My Team"
                : `Team ${teamNumber}`,

            isMyTeam:
              teamNumber ===
              myDraftSlot,
          };
        }
      );
    }, [
      leagueTeams,
      myDraftSlot,
    ]);

  function handleLeagueTeamChange(
    teamCount: number
  ) {
    const nextDraftSlot =
      Math.min(
        myDraftSlot,
        teamCount
      );

    setLeagueTeams(
      teamCount
    );

    setMyDraftSlot(
      nextDraftSlot
    );

    setDraftPicks(
      []
    );

    setSelectedDraftTeamId(
      getMyTeamId(
        nextDraftSlot
      )
    );
  }

  function handleDraftSlotChange(
    slot: number
  ) {
    setMyDraftSlot(
      slot
    );

    setDraftPicks(
      []
    );

    setSelectedDraftTeamId(
      getMyTeamId(
        slot
      )
    );
  }

  const draftedIds =
    useMemo(() => {
      return new Set(
        draftPicks.map(
          (
            pick
          ) =>
            pick.playerId
        )
      );
    }, [
      draftPicks,
    ]);

  const ownerByPlayerId =
    useMemo(() => {
      const result =
        new Map<
          string,
          string
        >();

      for (
        const pick of
        draftPicks
      ) {
        result.set(
          pick.playerId,
          pick.fantasyTeamId
        );
      }

      return result;
    }, [
      draftPicks,
    ]);

  const myTeamOrder =
    useMemo(() => {
      return draftPicks
        .filter(
          (
            pick
          ) =>
            pick.fantasyTeamId ===
            myTeamId
        )
        .sort(
          (
            a,
            b
          ) =>
            a.pickNumber -
            b.pickNumber
        )
        .map(
          (
            pick
          ) =>
            pick.playerId
        );
    }, [
      draftPicks,
      myTeamId,
    ]);

  /*
   * --------------------------------------------------------
   * BASE PLAYER VALUE
   * --------------------------------------------------------
   */
  const baseRankedPlayers =
  useMemo<BaseRankedPlayer[]>(() => {
    if (
      players.length === 0
    ) {
      return [];
    }

    // ... your existing stats calculation above ...


    // rest of your VOR logic continues here...

      const fantasyPool =
        [
          ...players,
        ]
          .sort(
            (
              a,
              b
            ) =>
              b.points -
              a.points
          )
          .slice(
            0,
            250
          );

      const stats =
        {} as Record<
          CategoryKey,
          {
            mean: number;
            stdDev: number;
          }
        >;

      for (
        const category of
        categoryKeys
      ) {
        const values =
          fantasyPool.map(
            (
              player
            ) =>
              player[
                category
              ]
          );

        const mean =
          values.reduce(
            (
              sum,
              value
            ) =>
              sum +
              value,
            0
          ) /
          values.length;

        const variance =
          values.reduce(
            (
              sum,
              value
            ) =>
              sum +
              Math.pow(
                value -
                  mean,
                2
              ),
            0
          ) /
          values.length;

        stats[
          category
        ] = {
          mean,

          stdDev:
            Math.sqrt(
              variance
            ),
        };
      }

      const basePlayers =
        players.map(
          (
            player
          ) => {
            const zScores =
              {} as Record<
                CategoryKey,
                number
              >;

            let rawScore =
              0;

            for (
              const category of
              categoryKeys
            ) {
              const {
                mean,
                stdDev,
              } =
                stats[
                  category
                ];

              const zScore =
                stdDev ===
                0
                  ? 0
                  : (
                      player[
                        category
                      ] -
                      mean
                    ) /
                    stdDev;

              zScores[
                category
              ] =
                zScore;

              rawScore +=
                zScore;
            }

            return {
              ...player,

              rawScore,

              zScores,
            };
          }
        );

      const replacementScores: Record<
        string,
        number
      > = {};

      for (
        const position of
        [
          "C",
          "LW",
          "RW",
          "D",
        ]
      ) {
        const requiredStarters =
          leagueTeams *
          STARTERS_PER_TEAM[
            position
          ];

        const positionalPlayers =
          basePlayers
            .filter(
              (
                player
              ) =>
                player.positions.includes(
                  position
                )
            )
            .sort(
              (
                a,
                b
              ) =>
                b.rawScore -
                a.rawScore
            );

        const replacementIndex =
          Math.max(
            0,
            Math.min(
              requiredStarters -
                1,
              positionalPlayers.length -
                1
            )
          );

        replacementScores[
          position
        ] =
          positionalPlayers[
            replacementIndex
          ]?.rawScore ??
          0;
      }

      return basePlayers.map(
        (
          player
        ) => {
          const eligiblePositions =
            player.positions.filter(
              (
                position
              ) =>
                replacementScores[
                  position
                ] !==
                undefined
            );

          let bestVor =
            Number.NEGATIVE_INFINITY;

          let bestPosition =
            eligiblePositions[
              0
            ] ??
            "—";

          for (
            const position of
            eligiblePositions
          ) {
            const vor =
              player.rawScore -
              replacementScores[
                position
              ];

            if (
              vor >
              bestVor
            ) {
              bestVor =
                vor;

              bestPosition =
                position;
            }
          }

          if (
            !Number.isFinite(
              bestVor
            )
          ) {
            bestVor =
              player.rawScore;
          }

          return {
            ...player,

            vor:
              bestVor,

            replacementPosition:
              bestPosition,
          };
        }
      );
    }, [
      players,
      leagueTeams,
    ]);

  const baseMyTeamPlayers =
    useMemo(() => {
      const map =
        new Map(
          baseRankedPlayers.map(
            (
              player
            ) => [
              player.id,
              player,
            ]
          )
        );

      return myTeamOrder
        .map(
          (
            id
          ) =>
            map.get(
              id
            )
        )
        .filter(
          (
            player
          ): player is BaseRankedPlayer =>
            player !==
            undefined
        );
    }, [
      baseRankedPlayers,
      myTeamOrder,
    ]);

  /*
   * --------------------------------------------------------
   * TEAM CATEGORY NEEDS
   * --------------------------------------------------------
   */
  const teamCategoryStrength =
    useMemo(() => {
      const result =
        {} as Record<
          CategoryKey,
          number
        >;

      for (
        const category of
        categoryKeys
      ) {
        if (
          baseMyTeamPlayers.length ===
          0
        ) {
          result[
            category
          ] =
            0;

          continue;
        }

        result[
          category
        ] =
          baseMyTeamPlayers.reduce(
            (
              sum,
              player
            ) =>
              sum +
              player.zScores[
                category
              ],
            0
          ) /
          baseMyTeamPlayers.length;
      }

      return result;
    }, [
      baseMyTeamPlayers,
    ]);

  const teamNeedWeights =
    useMemo(() => {
      const result =
        {} as Record<
          CategoryKey,
          number
        >;

      if (
        baseMyTeamPlayers.length ===
        0
      ) {
        for (
          const category of
          categoryKeys
        ) {
          result[
            category
          ] =
            1;
        }

        return result;
      }

      const strengths =
        categoryKeys.map(
          (
            category
          ) =>
            teamCategoryStrength[
              category
            ]
        );

      const averageStrength =
        strengths.reduce(
          (
            sum,
            value
          ) =>
            sum +
            value,
          0
        ) /
        strengths.length;

      for (
        const category of
        categoryKeys
      ) {
        const relativeStrength =
          teamCategoryStrength[
            category
          ] -
          averageStrength;

        result[
          category
        ] =
          Math.max(
            0.75,
            Math.min(
              1.35,
              1 -
                relativeStrength *
                  0.18
            )
          );
      }

      return result;
    }, [
      baseMyTeamPlayers.length,
      teamCategoryStrength,
    ]);

  /*
   * --------------------------------------------------------
   * FIRST-PASS PLAYER RANKING
   * --------------------------------------------------------
   */
  const rankedPlayers =
    useMemo<
      RankedPlayer[]
    >(() => {
      return baseRankedPlayers.map(
        (
          player
        ) => {
          let needBonus =
            0;

          for (
            const category of
            categoryKeys
          ) {
            needBonus +=
              player.zScores[
                category
              ] *
              (
                teamNeedWeights[
                  category
                ] -
                1
              );
          }

          needBonus *=
            0.75;

          return {
            ...player,

            needBonus,

            h2hGain:
              0,

            scarcityBonus:
              0,

            scarcityReasons:
              [],

            returnRisk:
              "SAFE",

            returnProbability:
              0,

            returnReason:
              "",

            picksUntilNext:
              0,

            seasonOffNightGames:
              0,

            playoffGames:
              0,

            playoffOffNightGames:
              0,

            playoffWeekGames:
              [
                0,
                0,
                0,
              ] as [
                number,
                number,
                number
              ],

            playoffWeekOffNights:
              [
                0,
                0,
                0,
              ] as [
                number,
                number,
                number
              ],

            scheduleBonus:
              0,

            score:
              player.vor +
              needBonus,
          };
        }
      );
    }, [
      baseRankedPlayers,
      teamNeedWeights,
    ]);

  const playerMap =
    useMemo(() => {
      return new Map(
        rankedPlayers.map(
          (
            player
          ) => [
            player.id,
            player,
          ]
        )
      );
    }, [
      rankedPlayers,
    ]);

  const myTeamPlayers =
    useMemo(() => {
      return myTeamOrder
        .map(
          (
            id
          ) =>
            playerMap.get(
              id
            )
        )
        .filter(
          (
            player
          ): player is RankedPlayer =>
            player !==
            undefined
        );
    }, [
      playerMap,
      myTeamOrder,
    ]);

  /*
   * --------------------------------------------------------
   * ROSTER FIT
   * --------------------------------------------------------
   */
  const assignedRoster =
    useMemo<
      RosterSlot[]
    >(() => {
      const assignments =
        new Map<
          string,
          RankedPlayer
        >();

      function tryAssign(
        player:
          RankedPlayer,
        visited:
          Set<string>
      ): boolean {
        for (
          const slot of
          STARTING_SLOTS
        ) {
          if (
            !player.positions.includes(
              slot.position
            ) ||
            visited.has(
              slot.id
            )
          ) {
            continue;
          }

          visited.add(
            slot.id
          );

          const existing =
            assignments.get(
              slot.id
            );

          if (
            !existing ||
            tryAssign(
              existing,
              visited
            )
          ) {
            assignments.set(
              slot.id,
              player
            );

            return true;
          }
        }

        return false;
      }

      const assignmentOrder =
        [
          ...myTeamPlayers,
        ].sort(
          (
            a,
            b
          ) =>
            a.positions.length -
            b.positions.length
        );

      for (
        const player of
        assignmentOrder
      ) {
        tryAssign(
          player,
          new Set()
        );
      }

      const starters:
        RosterSlot[] =
        STARTING_SLOTS.map(
          (
            slot
          ) => ({
            id:
              slot.id,

            position:
              slot.position,

            player:
              assignments.get(
                slot.id
              ),
          })
        );

      const starterIds =
        new Set(
          [
            ...assignments.values(),
          ].map(
            (
              player
            ) =>
              player.id
          )
        );

      const benchPlayers =
        myTeamPlayers.filter(
          (
            player
          ) =>
            !starterIds.has(
              player.id
            )
        );

      const bench:
        RosterSlot[] =
        Array.from(
          {
            length:
              BENCH_COUNT,
          },
          (
            _,
            index
          ) => ({
            id:
              `BN${
                index +
                1
              }`,

            position:
              "BN" as const,

            player:
              benchPlayers[
                index
              ],
          })
        );

      return [
        ...starters,
        ...bench,
      ];
    }, [
      myTeamPlayers,
    ]);

  const openStarterPositions =
    useMemo(() => {
      return assignedRoster
        .filter(
          (
            slot
          ) =>
            slot.position !==
              "BN" &&
            !slot.player
        )
        .map(
          (
            slot
          ) =>
            slot.position
        );
    }, [
      assignedRoster,
    ]);

  const teamTotals =
    useMemo(() => {
      return {
        goals:
          myTeamPlayers.reduce(
            (
              sum,
              player
            ) =>
              sum +
              player.goals,
            0
          ),

        assists:
          myTeamPlayers.reduce(
            (
              sum,
              player
            ) =>
              sum +
              player.assists,
            0
          ),

        points:
          myTeamPlayers.reduce(
            (
              sum,
              player
            ) =>
              sum +
              player.points,
            0
          ),

        ppp:
          myTeamPlayers.reduce(
            (
              sum,
              player
            ) =>
              sum +
              player.ppp,
            0
          ),

        sog:
          myTeamPlayers.reduce(
            (
              sum,
              player
            ) =>
              sum +
              player.sog,
            0
          ),

        hits:
          myTeamPlayers.reduce(
            (
              sum,
              player
            ) =>
              sum +
              player.hits,
            0
          ),

        blocks:
          myTeamPlayers.reduce(
            (
              sum,
              player
            ) =>
              sum +
              player.blocks,
            0
          ),
      };
    }, [
      myTeamPlayers,
    ]);

  /*
   * --------------------------------------------------------
   * LEAGUE ROSTERS
   * --------------------------------------------------------
   */
  const leagueTeamPlayers =
    useMemo(() => {
      const result =
        new Map<
          string,
          RankedPlayer[]
        >();

      for (
        const team of
        fantasyTeams
      ) {
        result.set(
          team.id,
          []
        );
      }

      const orderedPicks =
        [
          ...draftPicks,
        ].sort(
          (
            a,
            b
          ) =>
            a.pickNumber -
            b.pickNumber
        );

      for (
        const pick of
        orderedPicks
      ) {
        const player =
          playerMap.get(
            pick.playerId
          );

        if (
          !player
        ) {
          continue;
        }

        const teamPlayers =
          result.get(
            pick.fantasyTeamId
          );

        if (
          teamPlayers
        ) {
          teamPlayers.push(
            player
          );
        }
      }

      return result;
    }, [
      fantasyTeams,
      draftPicks,
      playerMap,
    ]);

  const scheduleAverages =
    useMemo(() => {
      const schedules =
        Object.values(
          playoffSchedule
        );

      if (
        schedules.length ===
        0
      ) {
        return {
          seasonOffNightGames:
            0,

          playoffOffNightGames:
            0,
        };
      }

      return {
        seasonOffNightGames:
          schedules.reduce(
            (
              sum,
              schedule
            ) =>
              sum +
              schedule.seasonOffNightGames,
            0
          ) /
          schedules.length,

        playoffOffNightGames:
          schedules.reduce(
            (
              sum,
              schedule
            ) =>
              sum +
              schedule.playoffOffNightGames,
            0
          ) /
          schedules.length,
      };
    }, [
      playoffSchedule,
    ]);

  /*
   * --------------------------------------------------------
   * FINAL NEVISLY SCORE
   * --------------------------------------------------------
   */
  const finalRankedPlayers =
    useMemo<
      RankedPlayer[]
    >(() => {
      return rankedPlayers.map(
        (
          player
        ) => {
          const teamSchedule =
            getTeamSchedule(
              playoffSchedule,
              player.team
            );

          const seasonOffNightGames =
            teamSchedule
              ?.seasonOffNightGames ??
            0;

          const playoffGames =
            teamSchedule
              ?.playoffGames ??
            0;

          const playoffOffNightGames =
            teamSchedule
              ?.playoffOffNightGames ??
            0;

          const playoffWeekGames: [
            number,
            number,
            number
          ] = [
            teamSchedule
              ?.playoffByWeek?.[
              "24"
            ]?.games ??
              0,

            teamSchedule
              ?.playoffByWeek?.[
              "25"
            ]?.games ??
              0,

            teamSchedule
              ?.playoffByWeek?.[
              "26"
            ]?.games ??
              0,
          ];

          const playoffWeekOffNights: [
            number,
            number,
            number
          ] = [
            teamSchedule
              ?.playoffByWeek?.[
              "24"
            ]
              ?.offNightGames ??
              0,

            teamSchedule
              ?.playoffByWeek?.[
              "25"
            ]
              ?.offNightGames ??
              0,

            teamSchedule
              ?.playoffByWeek?.[
              "26"
            ]
              ?.offNightGames ??
              0,
          ];

          const scheduleBonus =
            calculateScheduleBonus(
              teamSchedule,
              scheduleAverages
            );

          const ageRiskBonus =
            calculateAgeRiskBonus(
              player.age
            );


      if (
        draftedIds.has(
          player.id
        )
      ) {
        return {
          ...player,
      
          h2hGain:
            0,
      
          scarcityBonus:
            0,
      
          scarcityReasons:
            [],
      
          returnRisk:
            "SAFE",
      
          returnProbability:
            0,
      
          returnReason:
            "",
      
          picksUntilNext:
            0,
      
          seasonOffNightGames,
      
          playoffGames,
      
          playoffOffNightGames,
      
          playoffWeekGames,
      
          playoffWeekOffNights,
      
          scheduleBonus,
      
          score:
            player.vor +
            player.needBonus +
            scheduleBonus +
            ageRiskBonus,
        };
      }

          const h2h =
            calculateH2HImpact({
              player,

              fantasyTeams,

              leagueTeamPlayers,
            });

          const scarcity =
            calculateDraftRoomScarcity({
              player,

              allPlayers:
                rankedPlayers,

              draftPicks,

              fantasyTeams,
            });

          let flexibilityBonus =
            0;

          if (
            player.positions.length ===
            2
          ) {
            flexibilityBonus =
              0.1;
          } else if (
            player.positions.length >=
            3
          ) {
            flexibilityBonus =
              0.18;
          }

          const coversOpenPosition =
            player.positions.some(
              (
                position
              ) =>
                openStarterPositions.includes(
                  position as
                    | "C"
                    | "LW"
                    | "RW"
                    | "D"
                )
            );

          if (
            coversOpenPosition &&
            player.positions.length >
              1
          ) {
            flexibilityBonus +=
              0.08;
          }

          flexibilityBonus =
            Math.min(
              flexibilityBonus,
              0.25
            );

          const returnRisk =
            calculateReturnRisk({
              player,

              allPlayers:
                rankedPlayers,

              draftPicks,

              fantasyTeams,

              leagueTeams,

              myDraftSlot,
            });

          return {
            ...player,

            h2hGain:
              h2h.matchupGain,

            scarcityBonus:
              scarcity.scarcityBonus,

            scarcityReasons:
              scarcity.reasons,

            returnRisk:
              returnRisk.level,

            returnProbability:
              returnRisk.probability,

            returnReason:
              returnRisk.reason,

            picksUntilNext:
              returnRisk.picksUntilNext,

            seasonOffNightGames,

            playoffGames,

            playoffOffNightGames,

            playoffWeekGames,

            playoffWeekOffNights,

            scheduleBonus,

            score:
            player.vor +
            player.needBonus +
            h2h.matchupGain *
              1.25 +
            scarcity.scarcityBonus +
            flexibilityBonus +
            scheduleBonus +
            ageRiskBonus,
          };
        }
      );
    }, [
      rankedPlayers,
      draftedIds,
      fantasyTeams,
      leagueTeamPlayers,
      draftPicks,
      leagueTeams,
      myDraftSlot,
      openStarterPositions,
      playoffSchedule,
      scheduleAverages,
    ]);

  const bestAvailable =
    useMemo(() => {
      return [
        ...finalRankedPlayers,
      ]
        .filter(
          (
            player
          ) =>
            !draftedIds.has(
              player.id
            )
        )
        .sort(
          (
            a,
            b
          ) =>
            b.score -
            a.score
        )
        .slice(
          0,
          5
        );
    }, [
      finalRankedPlayers,
      draftedIds,
    ]);

  const filteredPlayers =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return [
        ...finalRankedPlayers,
      ]
        .filter(
          (
            player
          ) => {
            if (
              showDrafted
            ) {
              return true;
            }

            return !draftedIds.has(
              player.id
            );
          }
        )
        .filter(
          (
            player
          ) => {
            if (
              !query
            ) {
              return true;
            }

            return (
              player.name
                .toLowerCase()
                .includes(
                  query
                ) ||
              player.team
                .toLowerCase()
                .includes(
                  query
                )
            );
          }
        )
        .filter(
          (
            player
          ) => {
            if (
              positionFilter ===
              "ALL"
            ) {
              return true;
            }

            return player.positions.includes(
              positionFilter
            );
          }
        )
        .sort(
          (
            a,
            b
          ) => {
            const aValue =
              a[
                sortKey
              ];

            const bValue =
              b[
                sortKey
              ];

            if (
              typeof aValue ===
                "string" &&
              typeof bValue ===
                "string"
            ) {
              const result =
                aValue.localeCompare(
                  bValue
                );

              return sortDirection ===
                "asc"
                ? result
                : -result;
            }

            const result =
              Number(
                aValue
              ) -
              Number(
                bValue
              );

            return sortDirection ===
              "asc"
              ? result
              : -result;
          }
        );
    }, [
      finalRankedPlayers,
      search,
      positionFilter,
      sortKey,
      sortDirection,
      draftedIds,
      showDrafted,
    ]);

  function draftPlayer(
    playerId: string,
    fantasyTeamId: string
  ) {
    if (
      draftedIds.has(
        playerId
      )
    ) {
      return;
    }

    setDraftPicks(
      (
        current
      ) => {
        const nextPicks:
          DraftPick[] =
          [
            ...current,

            {
              playerId,

              fantasyTeamId,

              pickNumber:
                current.length +
                1,
            },
          ];

        const nextPickNumber =
          nextPicks.length +
          1;

        const nextTeamId =
          getSnakeTeamIdForPick(
            nextPickNumber,
            leagueTeams
          );

        setSelectedDraftTeamId(
          nextTeamId
        );

        return nextPicks;
      }
    );
  }

  function undoDraftPlayer(
    playerId: string
  ) {
    setDraftPicks(
      (
        current
      ) => {
        const next =
          current
            .filter(
              (
                pick
              ) =>
                pick.playerId !==
                playerId
            )
            .map(
              (
                pick,
                index
              ) => ({
                ...pick,

                pickNumber:
                  index +
                  1,
              })
            );

        const nextTeamId =
          getSnakeTeamIdForPick(
            next.length +
              1,
            leagueTeams
          );

        setSelectedDraftTeamId(
          nextTeamId
        );

        return next;
      }
    );
  }

  function undoLastPick() {
    setDraftPicks(
      (
        current
      ) => {
        const next =
          current.slice(
            0,
            -1
          );

        const nextTeamId =
          getSnakeTeamIdForPick(
            next.length +
              1,
            leagueTeams
          );

        setSelectedDraftTeamId(
          nextTeamId
        );

        return next;
      }
    );
  }

  function handleSort(
    key: SortKey
  ) {
    if (
      sortKey ===
      key
    ) {
      setSortDirection(
        (
          current
        ) =>
          current ===
          "asc"
            ? "desc"
            : "asc"
      );

      return;
    }

    setSortKey(
      key
    );

    setSortDirection(
      key ===
          "name" ||
        key ===
          "team"
        ? "asc"
        : "desc"
    );
  }

  function sortIndicator(
    key: SortKey
  ) {
    if (
      sortKey !==
      key
    ) {
      return "";
    }

    return sortDirection ===
      "asc"
      ? " ↑"
      : " ↓";
  }

  function getTeamName(
    teamId: string
  ) {
    return (
      fantasyTeams.find(
        (
          team
        ) =>
          team.id ===
          teamId
      )?.name ??
      teamId
    );
  }

  function getRecommendationReasons(
    player:
      RankedPlayer
  ) {
    const reasons:
      string[] =
      [];

    const availablePlayers =
      finalRankedPlayers.filter(
        (
          candidate
        ) =>
          !draftedIds.has(
            candidate.id
          )
      );

    const categoryRanks =
      categoryKeys
        .map(
          (
            category
          ) => {
            const sorted =
              [
                ...availablePlayers,
              ].sort(
                (
                  a,
                  b
                ) =>
                  b[
                    category
                  ] -
                  a[
                    category
                  ]
              );

            const rank =
              sorted.findIndex(
                (
                  candidate
                ) =>
                  candidate.id ===
                  player.id
              ) +
              1;

            return {
              category,

              rank,

              z:
                player.zScores[
                  category
                ],

              need:
                teamNeedWeights[
                  category
                ],
            };
          }
        )
        .sort(
          (
            a,
            b
          ) =>
            a.rank -
            b.rank
        );

    const numberOneCategories =
      categoryRanks.filter(
        (
          item
        ) =>
          item.rank ===
          1
      );

    for (
      const item of
      numberOneCategories
    ) {
      reasons.push(
        `#1 ${
          CATEGORY_LABELS[
            item.category
          ]
        }`
      );
    }

    const eliteCategories =
      categoryRanks
        .filter(
          (
            item
          ) =>
            item.rank >
              1 &&
            item.rank <=
              5 &&
            item.z >=
              1
        )
        .slice(
          0,
          2
        );

    for (
      const item of
      eliteCategories
    ) {
      reasons.push(
        `Elite ${
          CATEGORY_LABELS[
            item.category
          ]
        }`
      );
    }

    const neededCategories =
      categoryRanks
        .filter(
          (
            item
          ) =>
            item.need >=
              1.08 &&
            item.z >
              0.35
        )
        .sort(
          (
            a,
            b
          ) =>
            b.z *
              b.need -
            a.z *
              a.need
        )
        .slice(
          0,
          2
        );

    if (
      neededCategories.length >
      0
    ) {
      reasons.push(
        `Helps ${neededCategories
          .map(
            (
              item
            ) =>
              CATEGORY_LABELS[
                item.category
              ]
          )
          .join(
            " + "
          )}`
      );
    }

    const openPosition =
      player.positions.find(
        (
          position
        ) =>
          openStarterPositions.includes(
            position as
              | "C"
              | "LW"
              | "RW"
              | "D"
          )
      );

    if (
      openPosition
    ) {
      reasons.push(
        `Fills ${openPosition}`
      );
    }

    if (
      player.replacementPosition ===
        "D" &&
      player.vor >
        0
    ) {
      reasons.push(
        "Scarce D value"
      );
    }

    if (
      player.positions.length >
      1
    ) {
      reasons.push(
        `${player.positions.join(
          "/"
        )} flexibility`
      );
    }

    if (
      player.h2hGain >=
      0.15
    ) {
      reasons.push(
        "Improves H2H matchup strength"
      );
    }

    if (
      player.scarcityReasons.length >
      0
    ) {
      reasons.push(
        player
          .scarcityReasons[
          0
        ]
      );
    }

    if (
      player.playoffGames >=
      11
    ) {
      reasons.push(
        `${player.playoffGames} playoff games`
      );
    }

    if (
      player.seasonOffNightGames >=
      scheduleAverages.seasonOffNightGames +
        4
    ) {
      reasons.push(
        "Strong off-night schedule"
      );
    }

    if (
      player.playoffOffNightGames >=
      scheduleAverages.playoffOffNightGames +
        2
    ) {
      reasons.push(
        "Strong playoff off-nights"
      );
    }

    if (
      reasons.length ===
      0
    ) {
      reasons.push(
        "Best overall value"
      );
    }

    return reasons.slice(
      0,
      3
    );
  }

  const positions = [
    "ALL",
    "C",
    "LW",
    "RW",
    "D",
  ];

  const availableCount =
    players.length -
    draftPicks.length;

  const lastPick =
    draftPicks.length >
    0
      ? draftPicks[
          draftPicks.length -
            1
        ]
      : undefined;

  const lastPickPlayer =
    lastPick
      ? playerMap.get(
          lastPick.playerId
        )
      : undefined;

  const currentRound =
    Math.floor(
      draftPicks.length /
        leagueTeams
    ) +
    1;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1900px] flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
        <div className="mr-4 flex items-center gap-3">
  <div>
    <div className="text-xl font-black">
      NEVISLY
    </div>

    <div className="text-[10px] uppercase tracking-wider text-zinc-500">
      Championship Draft Assistant
    </div>
  </div>

  <NevislyLegend />
</div>

          {players.length >
            0 && (
            <>
              <TopStat
                label="Pick"
                value={`${
                  draftPicks.length +
                  1
                }`}
              />

              <TopStat
                label="Round"
                value={`${currentRound}`}
              />

              <TopStat
                label="Available"
                value={`${availableCount}`}
              />

              <div className="min-w-[165px]">
                <div className="mb-1 text-[9px] uppercase text-zinc-500">
                  Drafting Team
                </div>

                <select
                  value={
                    selectedDraftTeamId
                  }
                  onChange={(
                    event
                  ) =>
                    setSelectedDraftTeamId(
                      event
                        .target
                        .value
                    )
                  }
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                >
                  {fantasyTeams.map(
                    (
                      team
                    ) => (
                      <option
                        key={
                          team.id
                        }
                        value={
                          team.id
                        }
                      >
                        {
                          team.name
                        }
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="ml-auto flex items-center gap-3">
                {lastPick &&
                  lastPickPlayer && (
                    <div className="hidden text-right lg:block">
                      <div className="text-[9px] uppercase text-zinc-500">
                        Last Pick
                      </div>

                      <div className="text-xs">
                        {
                          lastPickPlayer.name
                        }
                        {" → "}
                        {getTeamName(
                          lastPick.fantasyTeamId
                        )}
                      </div>
                    </div>
                  )}

                <button
                  type="button"
                  onClick={
                    undoLastPick
                  }
                  disabled={
                    draftPicks.length ===
                    0
                  }
                  className="rounded-lg border border-red-900 px-3 py-2 text-xs font-semibold text-red-300 disabled:opacity-30"
                >
                  Undo Last
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-[1900px] p-4 lg:p-6">
        <section className="mb-5 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                Projection Engine
              </div>

              <h2 className="text-lg font-bold">
                Projection Sources
              </h2>

              <p className="mt-1 text-xs text-zinc-500">
                Upload any compatible projection CSV and choose how much influence each source has.
              </p>
            </div>

            <button
              type="button"
              onClick={
                addProjectionSource
              }
              className="rounded-lg border border-blue-800 px-3 py-2 text-xs font-bold text-blue-300 hover:bg-blue-950/40"
            >
              + Add Source
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {projectionSources.map(
              (
                source,
                index
              ) => (
                <div
                  key={
                    source.id
                  }
                  className="grid gap-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3 lg:grid-cols-[minmax(140px,220px)_110px_minmax(220px,1fr)_auto]"
                >
                  <div>
                    <div className="mb-1 text-[9px] uppercase text-zinc-600">
                      Source
                    </div>

                    <input
                      value={
                        source.name
                      }
                      onChange={(
                        event
                      ) =>
                        handleProjectionNameChange(
                          source.id,
                          event
                            .target
                            .value
                        )
                      }
                      className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-2 text-xs"
                      placeholder={`Source ${
                        index +
                        1
                      }`}
                    />
                  </div>

                  <div>
                    <div className="mb-1 text-[9px] uppercase text-zinc-600">
                      Weight
                    </div>

                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={
                          source.weight
                        }
                        onChange={(
                          event
                        ) =>
                          handleProjectionWeightChange(
                            source.id,
                            Number(
                              event
                                .target
                                .value
                            )
                          )
                        }
                        className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-2 text-xs"
                      />

                      <span className="text-xs text-zinc-500">
                        %
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 text-[9px] uppercase text-zinc-600">
                      CSV
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        type="file"
                        accept=".csv"
                        onChange={(
                          event
                        ) =>
                          handleProjectionFile(
                            source.id,
                            event
                          )
                        }
                        className="text-xs"
                      />

                      {source.players.length >
                        0 && (
                        <span className="text-[10px] text-emerald-400">
                          {
                            source.players.length
                          }{" "}
                          players loaded
                        </span>
                      )}
                    </div>

                    {source.fileName && (
                      <div className="mt-1 truncate text-[10px] text-zinc-600">
                        {
                          source.fileName
                        }
                      </div>
                    )}
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      disabled={
                        projectionSources.length <=
                        1
                      }
                      onClick={() =>
                        removeProjectionSource(
                          source.id
                        )
                      }
                      className="rounded-md border border-red-950 px-3 py-2 text-[10px] font-semibold text-red-400 disabled:opacity-20"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            <span className="text-zinc-500">
              Loaded sources:{" "}
              <strong className="text-zinc-300">
                {
                  loadedSourceCount
                }
              </strong>
            </span>

            <span className="text-zinc-500">
              Blended players:{" "}
              <strong className="text-zinc-300">
                {
                  players.length
                }
              </strong>
            </span>

            <span
              className={
                Math.abs(
                  totalProjectionWeight -
                    100
                ) <
                0.01
                  ? "text-emerald-400"
                  : "text-yellow-400"
              }
            >
              Weight total:{" "}
              {totalProjectionWeight.toFixed(
                0
              )}
              %
            </span>

            {totalProjectionWeight >
              0 &&
              Math.abs(
                totalProjectionWeight -
                  100
              ) >=
                0.01 && (
                <span className="text-[10px] text-zinc-600">
                  Nevisly automatically normalizes the weights.
                </span>
              )}
          </div>

          {projectionDiagnostics.activeSourceCount >
  1 && (
  <details className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950">
    <summary className="cursor-pointer px-3 py-3 text-xs font-semibold text-zinc-300">
      Projection Match Diagnostics
    </summary>

    <div className="border-t border-zinc-800 p-3">
      <div className="mb-3 grid gap-2 sm:grid-cols-3">
        <DiagnosticStat
          label="Sources"
          value={
            projectionDiagnostics.activeSourceCount
          }
        />

        <DiagnosticStat
          label="Matched All"
          value={
            projectionDiagnostics.matchedAcrossAllSources
          }
        />

        <DiagnosticStat
          label="Blended Pool"
          value={
            projectionDiagnostics.totalUniquePlayers
          }
        />
      </div>

      <div className="space-y-3">
        {projectionDiagnostics.sources.map(
          (
            source
          ) => (
            <div
              key={
                source.sourceId
              }
              className="rounded-lg border border-zinc-800 bg-zinc-900 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold">
                  {
                    source.sourceName
                  }
                </div>

                <div
                  className={`text-xs font-bold ${
                    source.matchPercentage >=
                    90
                      ? "text-emerald-400"
                      : source.matchPercentage >=
                          75
                        ? "text-yellow-400"
                        : "text-red-400"
                  }`}
                >
                  {
                    source.matchPercentage
                  }
                  % matched
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
                <span>
                  {
                    source.playerCount
                  }{" "}
                  players
                </span>

                <span>
                  {
                    source.matchedPlayers
                  }{" "}
                  matched
                </span>

                <span>
                  {
                    source.uniquePlayers
                  }{" "}
                  unique
                </span>
              </div>

              {source.uniquePlayerNames.length >
                0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-[10px] text-zinc-600 hover:text-zinc-400">
                    Show unmatched players
                  </summary>

                  <div className="mt-2 max-h-40 overflow-auto rounded-md bg-zinc-950 p-2">
                    <div className="flex flex-wrap gap-1.5">
                      {source.uniquePlayerNames.map(
                        (
                          name
                        ) => (
                          <span
                            key={
                              name
                            }
                            className="rounded border border-zinc-800 px-2 py-1 text-[10px] text-zinc-500"
                          >
                            {
                              name
                            }
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </details>
              )}
            </div>
          )
        )}
      </div>

      <div className="mt-3 text-[10px] text-zinc-600">
        Matching currently uses normalized player name + NHL team.
      </div>
    </div>
  </details>
)}

          {error && (
            <p className="mt-3 text-xs text-red-400">
              {error}
            </p>
          )}
        </section>

        {players.length ===
        0 ? (
          <div className="mx-auto mt-10 max-w-xl rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <h1 className="text-2xl font-bold">
              Start Nevisly
            </h1>

            <p className="mt-2 text-sm text-zinc-400">
              Upload at least one projection CSV above with a weight greater than 0%.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">
                  League
                </span>

                <select
                  value={
                    leagueTeams
                  }
                  onChange={(
                    event
                  ) =>
                    handleLeagueTeamChange(
                      Number(
                        event
                          .target
                          .value
                      )
                    )
                  }
                  className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
                >
                  {[
                    8,
                    10,
                    12,
                    14,
                    16,
                  ].map(
                    (
                      teams
                    ) => (
                      <option
                        key={
                          teams
                        }
                        value={
                          teams
                        }
                      >
                        {
                          teams
                        }{" "}
                        teams
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">
                  My Draft Slot
                </span>

                <select
                  value={
                    myDraftSlot
                  }
                  onChange={(
                    event
                  ) =>
                    handleDraftSlotChange(
                      Number(
                        event
                          .target
                          .value
                      )
                    )
                  }
                  className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
                >
                  {Array.from(
                    {
                      length:
                        leagueTeams,
                    },
                    (
                      _,
                      index
                    ) =>
                      index +
                      1
                  ).map(
                    (
                      slot
                    ) => (
                      <option
                        key={
                          slot
                        }
                        value={
                          slot
                        }
                      >
                        #{slot}
                      </option>
                    )
                  )}
                </select>
              </div>

              <span className="ml-auto text-xs text-zinc-500">
                H2H Categories · 90 sec pick
              </span>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="min-w-0">
                <section className="mb-5 overflow-hidden rounded-xl border border-emerald-800/60 bg-zinc-900">
                  <div className="border-b border-zinc-800 px-4 py-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                      Who should I take?
                    </div>

                    <h2 className="text-lg font-bold">
                      Best Available
                    </h2>
                  </div>

                  <div className="divide-y divide-zinc-800">
                    {bestAvailable.map(
                      (
                        player,
                        index
                      ) => {
                        const reasons =
                          getRecommendationReasons(
                            player
                          );

                        return (
<div
  key={
    player.id
  }
  onClick={() =>
    setSelectedPlayer(player)
  }
  className={`cursor-pointer grid gap-3 px-4 py-3 lg:grid-cols-[42px_minmax(200px,1fr)_110px_125px] lg:items-center ${
    index ===
    0
      ? "bg-emerald-950/25"
      : ""
  }`}
                          >
                            <div
                              className={`text-xl font-black ${
                                index ===
                                0
                                  ? "text-emerald-400"
                                  : "text-zinc-600"
                              }`}
                            >
                              #
                              {index +
                                1}
                            </div>

                            <div>
                              <div
                                className={
                                  index ===
                                  0
                                    ? "text-lg font-bold"
                                    : "font-semibold"
                                }
                              >
                                {
                                  player.name
                                }
                              </div>

                              <div className="mt-0.5 text-xs text-zinc-500">
                                {player.positions.join(
                                  "/"
                                )}
                                {" · "}
                                {
                                  player.team
                                }

                                {player.playoffGames >
                                  0 && (
                                  <>
                                    {" · "}
                                    PO{" "}
                                    {
                                      player.playoffGames
                                    }
                                  </>
                                )}
                              </div>

                              <div className="mt-1 text-xs text-zinc-300">
                                {reasons.join(
                                  " · "
                                )}
                              </div>

                              <ReturnRiskDisplay
                                level={
                                  player.returnRisk
                                }
                                probability={
                                  player.returnProbability
                                }
                                reason={
                                  player.returnReason
                                }
                                picksUntilNext={
                                  player.picksUntilNext
                                }
                              />
                            </div>

                            <div className="lg:text-right">
                              <div className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500">
                                Nevisly
                              </div>

                              <div
                                className={`font-black ${
                                  index ===
                                  0
                                    ? "text-2xl text-emerald-400"
                                    : "text-lg"
                                }`}
                              >
                                {player.score.toFixed(
                                  2
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                draftPlayer(
                                  player.id,
                                  myTeamId
                                )
                              }
                              className={`rounded-lg px-4 py-2 font-bold ${
                                index ===
                                0
                                  ? "bg-emerald-500 text-black hover:bg-emerald-400"
                                  : "border border-emerald-800 text-emerald-300"
                              }`}
                            >
                              MY PICK
                            </button>
                          </div>
                        );
                      }
                    )}
                  </div>
                </section>

                <section className="sticky top-[72px] z-30 mb-3 rounded-xl border border-zinc-800 bg-zinc-900/95 p-3 backdrop-blur">
                  <div className="flex flex-col gap-2 lg:flex-row">
                    <input
                      autoFocus
                      value={
                        search
                      }
                      onChange={(
                        event
                      ) =>
                        setSearch(
                          event
                            .target
                            .value
                        )
                      }
                      placeholder="Search player..."
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm lg:max-w-sm"
                    />

                    <div className="flex gap-1.5">
                      {positions.map(
                        (
                          position
                        ) => (
                          <button
                            key={
                              position
                            }
                            type="button"
                            onClick={() =>
                              setPositionFilter(
                                position
                              )
                            }
                            className={`rounded-lg px-3 py-2 text-xs font-bold ${
                              positionFilter ===
                              position
                                ? "bg-white text-black"
                                : "border border-zinc-700 bg-zinc-950"
                            }`}
                          >
                            {
                              position
                            }
                          </button>
                        )
                      )}
                    </div>

                    <label className="ml-auto flex items-center gap-2 text-xs text-zinc-500">
                      <input
                        type="checkbox"
                        checked={
                          showDrafted
                        }
                        onChange={(
                          event
                        ) =>
                          setShowDrafted(
                            event
                              .target
                              .checked
                          )
                        }
                      />

                      Drafted
                    </label>
                  </div>
                </section>

                <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
                  <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
                    <h2 className="font-semibold">
                      Player Pool
                    </h2>

                    const injury =
  injuryByPlayer.get(
    `${normalizePlayerName(
      player.name
    )}|${player.team
      .trim()
      .toUpperCase()}`
  );

                    <span className="text-xs text-zinc-500">
                      {
                        filteredPlayers.length
                      }
                    </span>
                  </div>

                  <div className="max-h-[720px] overflow-auto">
                    <table className="w-full min-w-[900px] text-xs">
                      <thead className="sticky top-0 z-20 bg-zinc-900 text-left text-zinc-400">
                        <tr>
                          <th className="p-2">
                            Pick
                          </th>

                          <SortableHeader
                            label="Player"
                            onClick={() =>
                              handleSort(
                                "name"
                              )
                            }
                            indicator={sortIndicator(
                              "name"
                            )}
                          />

                          <th className="p-2">
                            Pos
                          </th>

                          <SortableHeader
                            label="Team"
                            onClick={() =>
                              handleSort(
                                "team"
                              )
                            }
                            indicator={sortIndicator(
                              "team"
                            )}
                          />

                          <SortableHeader
                            label="Nevisly"
                            onClick={() =>
                              handleSort(
                                "score"
                              )
                            }
                            indicator={sortIndicator(
                              "score"
                            )}
                          />

                          <th className="p-2">
                            Gone Risk
                          </th>

                          <th className="p-2">
  Confidence
</th>

                          <SortableHeader
                            label="G"
                            onClick={() =>
                              handleSort(
                                "goals"
                              )
                            }
                            indicator={sortIndicator(
                              "goals"
                            )}
                          />

                          <SortableHeader
                            label="A"
                            onClick={() =>
                              handleSort(
                                "assists"
                              )
                            }
                            indicator={sortIndicator(
                              "assists"
                            )}
                          />

                          <SortableHeader
                            label="P"
                            onClick={() =>
                              handleSort(
                                "points"
                              )
                            }
                            indicator={sortIndicator(
                              "points"
                            )}
                          />

                          <SortableHeader
                            label="PPP"
                            onClick={() =>
                              handleSort(
                                "ppp"
                              )
                            }
                            indicator={sortIndicator(
                              "ppp"
                            )}
                          />

                          <SortableHeader
                            label="SOG"
                            onClick={() =>
                              handleSort(
                                "sog"
                              )
                            }
                            indicator={sortIndicator(
                              "sog"
                            )}
                          />

                          <SortableHeader
                            label="HIT"
                            onClick={() =>
                              handleSort(
                                "hits"
                              )
                            }
                            indicator={sortIndicator(
                              "hits"
                            )}
                          />

                          <SortableHeader
                            label="BLK"
                            onClick={() =>
                              handleSort(
                                "blocks"
                              )
                            }
                            indicator={sortIndicator(
                              "blocks"
                            )}
                          />

                          <th className="p-2">
                            Age
                          </th>

                          <SortableHeader
                            label="OFF"
                            onClick={() =>
                              handleSort(
                                "seasonOffNightGames"
                              )
                            }
                            indicator={sortIndicator(
                              "seasonOffNightGames"
                            )}
                          />

                          <SortableHeader
                            label="PO"
                            onClick={() =>
                              handleSort(
                                "playoffGames"
                              )
                            }
                            indicator={sortIndicator(
                              "playoffGames"
                            )}
                          />

                          <th className="p-2">
                            Status
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredPlayers.map(
                          (
                            player
                          ) => {
                            const ownerId =
                              ownerByPlayerId.get(
                                player.id
                              );

                            const drafted =
                              ownerId !==
                              undefined;

                            return (
<tr
  key={
    player.id
  }
  onClick={() =>
    setSelectedPlayer(player)
  }
  className={`cursor-pointer border-t border-zinc-800 ${
    drafted
      ? "opacity-40"
      : "hover:bg-zinc-800/50"
  }`}

                              >
                                <td className="p-2">
                                  {drafted ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        undoDraftPlayer(
                                          player.id
                                        )
                                      }
                                      className="text-[10px] text-red-400"
                                    >
                                      {getTeamName(
                                        ownerId
                                      )}{" "}
                                      · Undo
                                    </button>
                                  ) : (
                                    <div className="flex gap-1">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          draftPlayer(
                                            player.id,
                                            selectedDraftTeamId
                                          )
                                        }
                                        className="rounded border border-blue-800 px-2 py-1 text-[10px] text-blue-300"
                                      >
                                        Draft
                                      </button>

                                      {selectedDraftTeamId !==
                                        myTeamId && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            draftPlayer(
                                              player.id,
                                              myTeamId
                                            )
                                          }
                                          className="rounded border border-emerald-800 px-2 py-1 text-[10px] text-emerald-300"
                                        >
                                          Mine
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </td>

                                <td className="whitespace-nowrap p-2 font-semibold">
                                  {
                                    player.name
                                  }
                                </td>

                                <td className="p-2 text-zinc-400">
                                  {player.positions.join(
                                    "/"
                                  )}
                                </td>

                                <td className="p-2 text-zinc-400">
                                  {
                                    player.team
                                  }
                                </td>

                                <td className="p-2 font-black text-emerald-400">
                                  {player.score.toFixed(
                                    2
                                  )}
                                </td>

                                <td className="p-2">
                                  <GoneRiskBadge
                                    level={
                                      player.returnRisk
                                    }
                                    probability={
                                      player.returnProbability
                                    }
                                  />
                                </td>

                                <td className="p-2 text-[10px]">
                                <ProjectionConfidenceBadge
  confidence={
    player.projectionConfidence
  }
  sources={
    player.projectionSources
  }
  variance={
    player.projectionVariance
  }
/>
</td>

                                <HeatmapCell
                                  value={
                                    player.goals
                                  }
                                  zScore={
                                    player
                                      .zScores
                                      .goals
                                  }
                                />

                                <HeatmapCell
                                  value={
                                    player.assists
                                  }
                                  zScore={
                                    player
                                      .zScores
                                      .assists
                                  }
                                />

                                <HeatmapCell
                                  value={
                                    player.points
                                  }
                                  zScore={
                                    player
                                      .zScores
                                      .points
                                  }
                                />

                                <HeatmapCell
                                  value={
                                    player.ppp
                                  }
                                  zScore={
                                    player
                                      .zScores
                                      .ppp
                                  }
                                />

                                <HeatmapCell
                                  value={
                                    player.sog
                                  }
                                  zScore={
                                    player
                                      .zScores
                                      .sog
                                  }
                                />

                                <HeatmapCell
                                  value={
                                    player.hits
                                  }
                                  zScore={
                                    player
                                      .zScores
                                      .hits
                                  }
                                />

                                <HeatmapCell
                                  value={
                                    player.blocks
                                  }
                                  zScore={
                                    player
                                      .zScores
                                      .blocks
                                  }
                                />

                                <td
                                  className="p-2 text-zinc-500"
                                  title={`Age risk modifier: ${calculateAgeRiskBonus(
                                    player.age
                                  ).toFixed(
                                    2
                                  )}`}
                                >
                                  {
                                    player.age
                                  }
                                </td>

                                <td
                                  className="p-2 font-semibold text-zinc-300"
                                  title="Season off-night games"
                                >
                                  {player.seasonOffNightGames ||
                                    "—"}
                                </td>

                                <td
                                  className={`p-2 font-semibold ${
                                    player.playoffGames >=
                                    11
                                      ? "text-emerald-400"
                                      : player.playoffGames >
                                            0 &&
                                          player.playoffGames <=
                                            8
                                        ? "text-red-400"
                                        : "text-zinc-300"
                                  }`}
                                  title={`Yahoo Weeks 24-26 only · ${player.playoffOffNightGames} playoff off-night games · ${player.seasonOffNightGames} season off-night games`}
                                >
                                  {player.playoffGames ||
                                    "—"}
                                </td>

                              <td className="p-2">
  <InjuryBadge
    injury={
      injury
    }
  />
</td>
                              </tr>
                            );
                          }
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>

              <aside className="xl:sticky xl:top-[84px] xl:self-start">
              {selectedPlayer && (
  <section className="mb-4">
    <PlayerExplanationCard
      player={selectedPlayer}
    />
  </section>
)}
                <section className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                  <div className="flex justify-between">
                    <div>
                      <h2 className="font-bold">
                        My Team
                      </h2>

                      <span className="text-xs text-zinc-500">
                        {
                          myTeamPlayers.length
                        }{" "}
                        skaters
                      </span>
                    </div>

                    <div className="rounded-lg bg-zinc-950 px-3 py-2 text-center">
                      <div className="text-[9px] text-zinc-500">
                        OPEN
                      </div>

                      <div className="font-black">
                        {
                          openStarterPositions.length
                        }
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-7 gap-1">
                    {categoryKeys.map(
                      (
                        category
                      ) => (
                        <CompactNeed
                          key={
                            category
                          }
                          label={
                            CATEGORY_LABELS[
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

                  <div className="mt-4 space-y-1">
                    {assignedRoster.map(
                      (
                        slot
                      ) => (
                        <div
                          key={
                            slot.id
                          }
                          className="grid grid-cols-[38px_1fr_auto] gap-2 rounded-md bg-zinc-950 px-2 py-1.5 text-xs"
                        >
                          <span className="font-bold text-zinc-500">
                            {
                              slot.id
                            }
                          </span>

                          <span
                            className={
                              slot.player
                                ? "truncate font-medium"
                                : "text-zinc-700"
                            }
                          >
                            {slot.player?.name ??
                              "Empty"}
                          </span>

                          <span className="text-[10px] text-zinc-600">
                            {
                              slot.player?.team
                            }
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </section>

                <section className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                  <h2 className="mb-3 font-bold">
                    Team Totals
                  </h2>

                  <div className="grid grid-cols-4 gap-2">
                    <TinyStat
                      label="G"
                      value={
                        teamTotals.goals
                      }
                    />

                    <TinyStat
                      label="A"
                      value={
                        teamTotals.assists
                      }
                    />

                    <TinyStat
                      label="P"
                      value={
                        teamTotals.points
                      }
                    />

                    <TinyStat
                      label="PPP"
                      value={
                        teamTotals.ppp
                      }
                    />

                    <TinyStat
                      label="SOG"
                      value={
                        teamTotals.sog
                      }
                    />

                    <TinyStat
                      label="HIT"
                      value={
                        teamTotals.hits
                      }
                    />

                    <TinyStat
                      label="BLK"
                      value={
                        teamTotals.blocks
                      }
                    />
                  </div>
                </section>

                <section className="rounded-xl border border-blue-900/50 bg-zinc-900 p-4">
                  <div className="text-[10px] font-bold uppercase text-blue-400">
                    Draft Room
                  </div>

                  <div className="mt-1 text-xs text-zinc-500">
                    Snake order automatically advances after each pick.
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-1.5">
                    {fantasyTeams.map(
                      (
                        team
                      ) => (
                        <button
                          key={
                            team.id
                          }
                          type="button"
                          onClick={() =>
                            setSelectedDraftTeamId(
                              team.id
                            )
                          }
                          className={`rounded-md border px-2 py-2 text-left text-[10px] ${
                            selectedDraftTeamId ===
                            team.id
                              ? "border-blue-500 bg-blue-950/40"
                              : "border-zinc-800 bg-zinc-950 text-zinc-400"
                          }`}
                        >
                          <div className="truncate font-bold">
                            {
                              team.name
                            }
                          </div>

                          <div className="text-zinc-600">
                            {leagueTeamPlayers.get(
                              team.id
                            )?.length ??
                              0}{" "}
                            picks
                          </div>
                        </button>
                      )
                    )}
                  </div>
                </section>
              </aside>
            </div>

            <details className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900">
              <summary className="cursor-pointer px-4 py-3 font-semibold">
                League Rankings & Category Matrix
              </summary>

              <div className="px-4 pb-4">
                <LeagueRankings
                  fantasyTeams={
                    fantasyTeams
                  }
                  leagueTeamPlayers={
                    leagueTeamPlayers
                  }
                />
              </div>
            </details>
          </>
        )}
      </div>
    </main>
  );
}

function ReturnRiskDisplay({
  level,
  probability,
  reason,
  picksUntilNext,
}: {
  level: ReturnRiskLevel;
  probability: number;
  reason: string;
  picksUntilNext: number;
}) {
  let className =
    "text-zinc-500";

  if (
    level ===
    "TAKE NOW"
  ) {
    className =
      "text-red-400";
  } else if (
    level ===
    "RISKY"
  ) {
    className =
      "text-orange-400";
  } else if (
    level ===
    "POSSIBLE"
  ) {
    className =
      "text-yellow-400";
  }

  const percentage =
    Math.round(
      probability *
        100
    );

  return (
    <div className="mt-1">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`text-[10px] font-bold ${className}`}
        >
          GONE RISK:{" "}
          {percentage}%
        </span>

        <span className="text-[10px] text-zinc-600">
          {level}
        </span>

        {picksUntilNext >
          0 && (
          <span className="text-[10px] text-zinc-600">
            {
              picksUntilNext
            }{" "}
            picks until yours
          </span>
        )}
      </div>

      {reason && (
        <div className="mt-0.5 text-[10px] text-zinc-600">
          {reason}
        </div>
      )}
    </div>
  );
}

function GoneRiskBadge({
  level,
  probability,
}: {
  level: ReturnRiskLevel;
  probability: number;
}) {
  let className =
    "text-zinc-500";

  if (
    level ===
    "TAKE NOW"
  ) {
    className =
      "text-red-400";
  } else if (
    level ===
    "RISKY"
  ) {
    className =
      "text-orange-400";
  } else if (
    level ===
    "POSSIBLE"
  ) {
    className =
      "text-yellow-400";
  }

  return (
    <span
      className={`whitespace-nowrap text-[9px] font-bold ${className}`}
      title={
        level
      }
    >
      {Math.round(
        probability *
          100
      )}
      %
    </span>
  );
}

function TopStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5">
      <div className="text-[9px] uppercase text-zinc-500">
        {label}
      </div>

      <div className="font-black">
        {value}
      </div>
    </div>
  );
}

function TinyStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-md bg-zinc-950 p-2">
      <div className="text-[9px] text-zinc-600">
        {label}
      </div>

      <div className="text-sm font-bold">
        {Number.isInteger(
          value
        )
          ? value
          : value.toFixed(
              1
            )}
      </div>
    </div>
  );
}

function CompactNeed({
  label,
  weight,
}: {
  label: string;
  weight: number;
}) {
  let className =
    "border-zinc-700 bg-zinc-950 text-zinc-400";

  if (
    weight >=
    1.1
  ) {
    className =
      "border-red-900 bg-red-950/40 text-red-300";
  } else if (
    weight <=
    0.9
  ) {
    className =
      "border-emerald-900 bg-emerald-950/40 text-emerald-300";
  }

  return (
    <div
      className={`rounded-md border px-1 py-2 text-center ${className}`}
      title={`Need weight ${weight.toFixed(
        2
      )}×`}
    >
      <div className="text-[9px] font-bold">
        {label}
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
      className="p-2 font-medium"
      style={getHeatmapStyle(
        zScore
      )}
      title={`Z-score: ${zScore.toFixed(
        2
      )}`}
    >
      {Number.isInteger(
        value
      )
        ? value
        : value.toFixed(
            1
          )}
    </td>
  );
}

function getHeatmapStyle(
  zScore: number
): CSSProperties {
  if (
    zScore >=
    2
  ) {
    return {
      backgroundColor:
        "rgba(22, 163, 74, 0.70)",

      color:
        "#fff",
    };
  }

  if (
    zScore >=
    1
  ) {
    return {
      backgroundColor:
        "rgba(22, 163, 74, 0.42)",
    };
  }

  if (
    zScore >=
    0.35
  ) {
    return {
      backgroundColor:
        "rgba(22, 163, 74, 0.20)",
    };
  }

  if (
    zScore >
    -0.35
  ) {
    return {
      backgroundColor:
        "rgba(113,113,122,0.10)",
    };
  }

  if (
    zScore >
    -1
  ) {
    return {
      backgroundColor:
        "rgba(220,38,38,0.18)",
    };
  }

  if (
    zScore >
    -2
  ) {
    return {
      backgroundColor:
        "rgba(220,38,38,0.38)",
    };
  }

  return {
    backgroundColor:
      "rgba(220,38,38,0.65)",

    color:
      "#fff",
  };
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
    <th className="p-2">
      <button
        type="button"
        onClick={
          onClick
        }
        className="whitespace-nowrap font-semibold hover:text-white"
      >
        {label}
        {indicator}
      </button>
    </th>
  );
}
function DiagnosticStat({
    label,
    value,
  }: {
    label: string;
    value: number;
  }) {
    return (
      <div className="rounded-md bg-zinc-900 p-2">
        <div className="text-[9px] uppercase text-zinc-600">
          {label}
        </div>
  
        <div className="mt-0.5 text-sm font-black text-zinc-200">
          {value}
        </div>
      </div>
    );
  }

  function ProjectionConfidenceBadge({
    confidence,
    sources,
    variance,
  }: {
    confidence?: "HIGH" | "MEDIUM" | "LOW";
    sources?: number;
    variance?: number;
  }) {
    if (!confidence) {
      return <span className="text-zinc-600">—</span>;
    }
  
    const color =
      confidence === "HIGH"
        ? "text-emerald-400"
        : confidence === "MEDIUM"
          ? "text-yellow-400"
          : "text-red-400";
  
    return (
      <details className="cursor-pointer">
        <summary className={`${color} font-bold`}>
          {confidence}
        </summary>
  
        <div className="mt-2 w-48 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-[10px] text-zinc-400">
  
          <div>
            Sources:
            <span className="ml-1 text-zinc-200">
              {sources ?? 1}
            </span>
          </div>
  
          <div className="mt-1">
            Variance:
            <span className="ml-1 text-zinc-200">
              {variance?.toFixed(1) ?? "—"}
            </span>
          </div>
  
          <div className="mt-2 text-zinc-500">
            {confidence === "HIGH" &&
              "Multiple projections agree closely."}
  
            {confidence === "MEDIUM" &&
              "Limited projection agreement."}
  
            {confidence === "LOW" &&
              "High uncertainty or limited data."}
          </div>
  
        </div>
      </details>
    );
  }

  function InjuryBadge({
    injury,
  }: {
    injury?: InjuryStatus;
  }) {
    if (
      !injury
    ) {
      return (
        <span className="text-zinc-700">
          —
        </span>
      );
    }
  
    const status =
      injury.status
        .trim()
        .toLowerCase();
  
    let label =
      injury.status;
  
    let className =
      "text-yellow-400";
  
    if (
      status.includes(
        "day"
      )
    ) {
      label =
        "DTD";
  
      className =
        "text-yellow-400";
    } else if (
      status.includes(
        "reserve"
      ) ||
      status ===
        "ir"
    ) {
      label =
        "IR";
  
      className =
        "text-red-400";
    } else if (
      status.includes(
        "out"
      )
    ) {
      label =
        "OUT";
  
      className =
        "text-red-400";
    }
  
    return (
      <span
        className={`whitespace-nowrap text-[10px] font-bold ${className}`}
        title={[
          injury.status,
          injury.injuryType,
          injury.returnDate
            ? `Return: ${injury.returnDate}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      >
        {label}
      </span>
    );
  }