"use client";
import { LEAGUE_TEAM_OPTIONS } from '@/lib/league';
import { rankRecommendations, compareRecommendations, availableRecommendationRanks, type Recommendation } from "@/lib/model/engine";
import { defaultMarketSnapshot } from '@/lib/model/marketDemand';
import MarketTimingSettings from '@/components/MarketTimingSettings';
import { rosterSelectionCapacity } from "@/lib/model/config";
import { initializeRankedPlayer } from "@/lib/model/player";
import { replacementValues } from "@/lib/model/replacement";
import type { ReturnRiskLevel } from "@/lib/draft/returnRisk";
import { legacyStrength, legacyWeights, type BaseRankedPlayer, type RankedPlayer } from "@/lib/model/legacy";
export type { BaseRankedPlayer, RankedPlayer } from "@/lib/model/legacy";

import { hasProjectionValue, projectionStartMessage } from '@/lib/projections/quality';
import {
  useEffect,
  useCallback,
  useMemo,
  useState,
  type CSSProperties,
  type ChangeEvent,
} from "react";

import { applyYahooEligibility } from "@/lib/draft/yahooV2";
import YahooBridgePanel from "@/components/YahooBridgePanel";
import { applyYahooMessage } from "@/lib/draft/yahoo";
import { getNextTurn } from "@/lib/draft/state";

import { useDraftSession } from "@/hooks/useDraftSession";
import { SESSION_KEY, type ProjectionSourceState } from "@/lib/session/session";

import { nextPickNumber, getSnakeTeamIdForPick, draftReducer } from "@/lib/draft/state";

import { parseSkaterCsv } from "@/lib/projections/parseSkaterCsv";
import { parseGoalieCsv } from "@/lib/projections/parseGoalieCsv";
import GoalieBoard from "@/components/GoalieBoard";
import type { RankedGoalie } from "@/types/goalie";

import DecisionBoard from "@/components/DecisionBoard";
import PlayerExplanationCard from "@/components/PlayerExplanationCard";
import PowerPlayBadge from "@/components/PowerPlayBadge";
import { powerPlayKey, type PowerPlayAssignment } from "@/lib/nhl/powerPlay";

import {
    blendSkaterProjections,
    getProjectionDiagnostics,
    type ProjectionSource,
  } from "@/lib/projections/blendSkaterProjections";


import type { DraftPick, FantasyTeam } from "@/types/draft";

import LeagueRankings from "@/components/LeagueRankings";

import NevislyLegend from "@/components/NevislyLegend";




import {
  type PlayoffScheduleMap,
} from "@/lib/draft/playoffSchedule";



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

  type InjuryStatus = {
    id: string;
    name: string;
    team: string;
    status: string;
    injuryType: string | null;
    returnDate: string | null;
  };

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





export default function ProjectionUpload() {
  const [marketSnapshot,setMarketSnapshot]=useState(defaultMarketSnapshot);
  const session = useDraftSession();
  const { projectionSources, draftPicks, leagueTeams, myDraftSlot } = session.data;
  const goalieProjection = session.data.goalieProjection ?? {fileName:"",players:[]};
  const setProjectionSources = (value: ProjectionSourceState[] | ((s:ProjectionSourceState[])=>ProjectionSourceState[])) => session.setField("projectionSources", value);
  const {setField} = session;
  const setDraftPicks = useCallback((value: DraftPick[] | ((s:DraftPick[])=>DraftPick[])) => setField("draftPicks", value), [setField]);
  const [manualName, setManualName] = useState("");
  const [manualKind, setManualKind] = useState("unknown");
  const [correctionNumber, setCorrectionNumber] = useState("");

    const [
        injuries,
        setInjuries,
      ] = useState<InjuryStatus[]>([]);

  const [
    powerPlayAssignments,
    setPowerPlayAssignments,
  ] = useState<PowerPlayAssignment[]>([]);

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

  const [projectionSourcesCollapsed,setProjectionSourcesCollapsed]=useState(false);
  const [activePool,setActivePool]=useState<"skaters"|"goalies">("skaters");

    const [
        selectedPlayer,
        setSelectedPlayer,
      ] = useState<Recommendation | null>(null);

  const [draftTeamOverride, setDraftTeamOverride] = useState<{pick:number;team:string}|null>(null);
  const selectedDraftTeamId = draftTeamOverride?.pick === nextPickNumber(draftPicks) ? draftTeamOverride.team : getSnakeTeamIdForPick(nextPickNumber(draftPicks),leagueTeams);
  const setSelectedDraftTeamId = (team:string) => setDraftTeamOverride({pick:nextPickNumber(draftPicks),team});

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

      return applyYahooEligibility(blendSkaterProjections(sources),draftPicks);
    }, [
      activeProjectionSources,draftPicks,
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
    // Intentionally preserve selections; missing projections remain represented in draft history.
  }

  async function handleGoalieProjectionFile(file:File) {
    try {
      setError("");
      const parsedPlayers=await parseGoalieCsv(file);
      session.setField("goalieProjection",{fileName:file.name,players:parsedPlayers});
    } catch(cause) {
      setError(`Could not read ${file.name}: ${cause instanceof Error ? cause.message : "invalid goalie CSV"}`);
    }
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
    } catch (cause) {
      setError(
        `Could not read ${file.name}: ${cause instanceof Error ? cause.message : "invalid CSV"}`
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

  const powerPlayByPlayer =
    useMemo(() => {
      const map = new Map<string, PowerPlayAssignment>();

      for (const assignment of powerPlayAssignments) {
        map.set(
          powerPlayKey(assignment.name, assignment.team),
          assignment
        );
      }

      return map;
    }, [powerPlayAssignments]);

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
    async function loadPowerPlay() {
      try {
        const response = await fetch("/api/nhl/power-play");

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        setPowerPlayAssignments(data.players ?? []);
      } catch {
        /* Power-play deployment is supplemental and never blocks drafting. */
      }
    }

    loadPowerPlay();
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

  function handleLeagueTeamChange(teamCount:number) {
    if (draftPicks.length) { setError("Start a new draft before changing league size."); return; }
    session.update(s=>({...s,leagueTeams:teamCount,myDraftSlot:Math.min(s.myDraftSlot,teamCount)}));
  }
  function handleDraftSlotChange(slot:number) { session.setField("myDraftSlot",slot); }

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

  const {update: updateSession} = session;
  useEffect(()=>{
    const receive = (kind:"pick"|"snapshot") => (event:Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      updateSession(current=>applyYahooMessage(current,detail,kind,blendSkaterProjections(current.projectionSources)));
    };
    const pick=receive("pick"), snapshot=receive("snapshot");
    window.addEventListener("nevisly-yahoo-pick",pick);
    window.addEventListener("nevisly-yahoo-snapshot",snapshot);
    window.dispatchEvent(new CustomEvent("nevisly-yahoo-request-snapshot"));
    return ()=>{window.removeEventListener("nevisly-yahoo-pick",pick);window.removeEventListener("nevisly-yahoo-snapshot",snapshot);};
  },[updateSession]);
  const [clock,setClock]=useState(0);
  useEffect(()=>{const timer=window.setInterval(()=>setClock(Date.now()),1000);return ()=>window.clearInterval(timer);},[]);

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
  const projectionMarket = useMemo(() => replacementValues(players, leagueTeams), [players, leagueTeams]);
  const baseRankedPlayers: BaseRankedPlayer[] = projectionMarket.ranked;

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
    useMemo(() => legacyStrength(baseMyTeamPlayers), [
      baseMyTeamPlayers,
    ]);

  const teamNeedWeights =
    useMemo(() => legacyWeights(baseMyTeamPlayers, teamCategoryStrength), [
      baseMyTeamPlayers,
      teamCategoryStrength,
    ]);

    const highestCompletedPick =
  draftPicks.reduce(
    (
      highest,
      pick
    ) =>
      Math.max(
        highest,
        pick.pickNumber
      ),
    0
  );

const currentPickNumber =
  highestCompletedPick + 1;

const currentRound =
  Math.floor(
    highestCompletedPick /
      leagueTeams
  ) + 1;

  // Compatibility fields for existing roster/table consumers; no scoring here.
  const rankedPlayers = useMemo(() => baseRankedPlayers.map(initializeRankedPlayer), [baseRankedPlayers]);

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

  const myGoalieCount =
    draftPicks.filter(p=>p.fantasyTeamId===myTeamId&&(p.positions?.includes("G")||p.resolution==="goalie")).length;

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
      Recommendation[]
    >(() => rankRecommendations({rankedPlayers, draftedIds, fantasyTeams, leagueTeamPlayers, draftPicks, leagueTeams, myDraftSlot, openStarterPositions, playoffSchedule, scheduleAverages, currentRound, myTeamPlayers}, projectionMarket, marketSnapshot), [
      marketSnapshot,
      projectionMarket,
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
      currentRound,
      myTeamPlayers,
    ]);

  const overallRecommendationRanks = useMemo(() => availableRecommendationRanks(finalRankedPlayers, draftedIds), [finalRankedPlayers, draftedIds]);

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
        .sort(compareRecommendations)
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

  function draftGoalie(goalie:RankedGoalie,fantasyTeamId:string) {
    setDraftPicks(current=>{
      const next=draftReducer(current,{type:"record",pick:{
        playerId:goalie.id,
        playerName:goalie.name,
        nhlTeam:goalie.team,
        positions:["G"],
        resolution:"goalie",
        source:"manual",
        fantasyTeamId,
        pickNumber:nextPickNumber(current),
      }});
      setSelectedDraftTeamId(getSnakeTeamIdForPick(nextPickNumber(next),leagueTeams));
      return next;
    });
  }

  function draftPlayer(playerId: string, fantasyTeamId: string) {
    setDraftPicks(current => {
      const next = draftReducer(current, {type: "record", pick: {playerId, fantasyTeamId, pickNumber: nextPickNumber(current), source: "manual", playerName: players.find(p=>p.id===playerId)?.name, resolution: "matched"}});
      setSelectedDraftTeamId(getSnakeTeamIdForPick(nextPickNumber(next), leagueTeams));
      return next;
    });
  }
  function undoDraftPlayer(playerId: string) {
    setDraftPicks(current => {
      const pick = current.find(p => p.playerId === playerId);
      const next = pick ? draftReducer(current, {type: "remove", pickNumber: pick.pickNumber}) : current;
      setSelectedDraftTeamId(getSnakeTeamIdForPick(nextPickNumber(next), leagueTeams));
      return next;
    });
  }
  function undoLastPick() {
    setDraftPicks(current => {
      const next = draftReducer(current, {type: "undo-last"});
      setSelectedDraftTeamId(getSnakeTeamIdForPick(nextPickNumber(next), leagueTeams));
      return next;
    });
  }

  function recordManualSelection() {
    if (!manualName.trim()) return;
    const number = correctionNumber ? Number(correctionNumber) : nextPickNumber(draftPicks);
    if (!Number.isSafeInteger(number) || number < 1) { setError("Enter a valid pick number."); return; }
    setDraftPicks(current=>draftReducer(current,{type:correctionNumber ? "correct" : "record",pick:{playerId:`selection:${crypto.randomUUID()}`,playerName:manualName.trim(),positions:manualKind === "goalie" ? ["G"] : [],resolution:manualKind === "goalie" ? "goalie" : "unresolved",source:"manual",fantasyTeamId:selectedDraftTeamId,pickNumber:number}}));
    setManualName("");setCorrectionNumber("");
    setSelectedDraftTeamId(getSnakeTeamIdForPick(nextPickNumber(draftPicks) + (correctionNumber ? 0 : 1),leagueTeams));
  }
  function exportSession() {
    const url=URL.createObjectURL(new Blob([session.warning.includes("could not be read") ? (window.localStorage.getItem(SESSION_KEY) ?? JSON.stringify(session.data)) : JSON.stringify(session.data,null,2)],{type:"application/json"}));
    const a=document.createElement("a");a.href=url;a.download="nevisly-draft.json";a.click();URL.revokeObjectURL(url);
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

  const positions = [
    "ALL",
    "C",
    "LW",
    "RW",
    "D",
  ];

  const availableCount = players.filter(player=>!draftedIds.has(player.id)).length;

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
  const lastPickName = lastPickPlayer?.name ?? lastPick?.playerName;

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
                value={`${currentPickNumber}`}
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
                  lastPickName && (
                    <div className="hidden text-right lg:block">
                      <div className="text-[9px] uppercase text-zinc-500">
                        Last Pick
                      </div>

                      <div className="text-xs">
                        {
                          lastPickName
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
        <YahooBridgePanel />
        {!session.data.bridge && <details className="mb-3 rounded border border-zinc-700 bg-zinc-950/40 px-3 py-2 text-sm">
          <summary className="cursor-pointer select-none text-zinc-300">
            Yahoo sync · <strong>{!session.data.sync?.health?.lastMessageAt ? "NONE" : clock-session.data.sync.health.lastMessageAt>30000 ? "NO RECENT MESSAGE" : "RECEIVED"}</strong>
            <span className="ml-2 text-xs text-zinc-500">next own #{getNextTurn(draftPicks,leagueTeams,myDraftSlot).nextMyPick}</span>
          </summary>
          <div role="status" className="mt-2 border-t border-zinc-800 pt-2 text-xs text-zinc-400">
            <div>Extraction: {session.data.sync?.health?.extraction ?? "unverified"} · History coverage: {session.data.sync?.health?.history ?? "unverified"} · Projection matching: {draftPicks.filter(p=>p.resolution === "unresolved" || p.resolution === "ambiguous").length} unresolved</div>
            <div className="mt-1">{session.data.sync?.message ?? "Manual drafting available"}</div>
            <div className="mt-1">Represented: {draftPicks.length} · Unmatched: {draftPicks.filter(p=>p.resolution === "unresolved" || p.resolution === "ambiguous").length} · Last accepted v1 snapshot: {session.data.sync?.lastSnapshotAt ? `${Math.max(0,Math.floor((clock-session.data.sync.lastSnapshotAt)/1000))}s ago` : "none"}</div>
            <div className="mt-1">Next own selection: {getNextTurn(draftPicks,leagueTeams,myDraftSlot).nextMyPick} · {getNextTurn(draftPicks,leagueTeams,myDraftSlot).opponentTeamIds.length} opponent selections before it</div>
            <button onClick={()=>window.dispatchEvent(new CustomEvent("nevisly-yahoo-request-snapshot"))} className="mt-2 underline">Request fresh snapshot</button>
          </div>
        </details>}
        {session.warning && <p role="alert" className="mb-3 text-amber-300">{session.warning}</p>}
        <details className="mb-4 rounded border border-zinc-700 p-3">
          <summary>Draft history & manual fallback · {draftPicks.length} selections · next pick {currentPickNumber}</summary>
          <div className="mt-3 flex flex-wrap gap-2">
            <input aria-label="Unprojected player name" placeholder="Goalie / unknown player name" value={manualName} onChange={e=>setManualName(e.target.value)} className="bg-zinc-900 p-2" />
            <select aria-label="Player kind" value={manualKind} onChange={e=>setManualKind(e.target.value)} className="bg-zinc-900 p-2"><option value="unknown">Unknown / unprojected</option><option value="goalie">Goalie</option></select>
            <select aria-label="Manual pick owner" value={selectedDraftTeamId} onChange={e=>setSelectedDraftTeamId(e.target.value)} className="bg-zinc-900 p-2">{fantasyTeams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
            <input aria-label="Pick number to correct" placeholder="Correction pick # (optional)" value={correctionNumber} onChange={e=>setCorrectionNumber(e.target.value)} className="bg-zinc-900 p-2" />
            <button onClick={recordManualSelection} className="border p-2">Record selection</button><button onClick={exportSession} className="border p-2">Export draft</button>
            <button onClick={()=>{if(window.confirm("Start a new draft? Export your current draft first.")){session.recover();session.update(s=>({...s,id:crypto.randomUUID(),draftPicks:[],sync:undefined,bridge:undefined}));}}} className="border p-2">New draft</button>
          </div>
          <ol className="mt-3 max-h-52 overflow-auto">{draftPicks.map(p=><li key={p.pickNumber}>#{p.pickNumber} · {p.ownerName || getTeamName(p.fantasyTeamId)} · {players.find(x=>x.id===p.playerId)?.name || p.playerName || "Unresolved selection"} · {p.resolution ?? "matched"} {(p.resolution === "unresolved" || p.resolution === "ambiguous") && <select aria-label={`Resolve pick ${p.pickNumber}`} value="" onChange={e=>{const candidate=players.find(x=>x.id===e.target.value);if(candidate)setDraftPicks(current=>draftReducer(current,{type:"correct",pick:{...p,playerId:candidate.id,projectionId:candidate.id,manualProjectionId:candidate.id,resolution:"matched"}}));}} className="ml-2 bg-zinc-900"><option value="">Match to projection…</option>{players.filter(x=>!draftedIds.has(x.id)).map(x=><option key={x.id} value={x.id}>{x.name} · {x.team}</option>)}</select>} <button onClick={()=>undoDraftPlayer(p.playerId)} className="ml-2 text-red-300">Undo</button></li>)}</ol>
        </details>
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
                {projectionSourcesCollapsed
                  ? `${loadedSourceCount} sources · ${players.length} rankable players · ${totalProjectionWeight.toFixed(0)}% total weight`
                  : "Upload compatible raw projection CSVs and choose how much influence each source has."}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={()=>setProjectionSourcesCollapsed(current=>!current)}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800/70"
              >
                {projectionSourcesCollapsed ? "Expand" : "Collapse"}
              </button>
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
          </div>

          <div className={projectionSourcesCollapsed ? "hidden" : ""}>
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
                          skater rows parsed
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
              Rankable players:{" "}
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

          <p className="mt-3 text-xs text-zinc-400">Blank statistics are missing, not zero. Each field uses only providers that supply it. Ranking requires G, A, P, PPP, SOG, HIT and BLK. Age and GP are optional: unavailable age has no age adjustment. Rows with missing scoring categories stay saved but are not ranked. Agreement measures point-projection spread, not calibrated accuracy. Re-upload older files if blanks were previously imported as zero.</p>
          {projectionDiagnostics.warnings.length > 0 && <details className="mt-3 text-xs text-amber-300"><summary>Projection data issues ({projectionDiagnostics.warnings.length})</summary><ul className="mt-2 space-y-1">{projectionDiagnostics.warnings.map((message, index) => <li key={index}>{message}</li>)}</ul></details>}

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
        Projection matching uses normalized player names; conflicting identities are excluded and team disagreements are flagged.
      </div>
    </div>
  </details>
)}
          </div>

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
              {projectionStartMessage(projectionSources, players.length)}
            </p>
          </div>
        ) : (
          <>
            <MarketTimingSettings snapshot={marketSnapshot} onChange={setMarketSnapshot} />
            <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">
                  League Size
                </span>

                <select
                  aria-label="League size"
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
                  {LEAGUE_TEAM_OPTIONS.map(
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
                H2H Categories · 60 sec pick
              </span>
            </div>

            <div className="mb-3 flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-1">
              <button type="button" onClick={()=>setActivePool("skaters")} className={`rounded-lg px-4 py-2 text-xs font-bold ${activePool==="skaters"?"bg-white text-black":"text-zinc-400 hover:bg-zinc-800"}`}>Skaters</button>
              <button type="button" onClick={()=>setActivePool("goalies")} className={`rounded-lg px-4 py-2 text-xs font-bold ${activePool==="goalies"?"bg-white text-black":"text-zinc-400 hover:bg-zinc-800"}`}>Goalies <span className="ml-1 text-[10px] opacity-60">W · SV% · SO</span></button>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="min-w-0">
                {activePool==="goalies" ? (
                  <GoalieBoard
                    goalies={goalieProjection.players}
                    fileName={goalieProjection.fileName}
                    draftPicks={draftPicks}
                    myTeamId={myTeamId}
                    selectedDraftTeamId={selectedDraftTeamId}
                    onUpload={handleGoalieProjectionFile}
                    onDraft={draftGoalie}
                    onUndo={pick=>setDraftPicks(current=>draftReducer(current,{type:"remove",pickNumber:pick.pickNumber}))}
                  />
                ) : (
                  <>
                <DecisionBoard players={bestAvailable} onInspect={setSelectedPlayer} onDraft={id=>draftPlayer(id,myTeamId)} rosterFull={draftPicks.filter(p=>p.fantasyTeamId===myTeamId).length>=rosterSelectionCapacity} powerPlayByPlayer={powerPlayByPlayer} />

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
                          <th className="p-2" title="Current overall Nevisly rank among available players; unchanged by search or position filters">Rank</th>
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

                          <th className="p-2" title="Current projected power-play unit from Daily Faceoff; informational only">
                            PP
                          </th>

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
                            Draft urgency
                          </th>

                          <th className="p-2">
  Agreement
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

    const injury =
      injuryByPlayer.get(
        `${normalizePlayerName(
          player.name
        )}|${player.team
          .trim()
          .toUpperCase()}`
      );

    const powerPlay =
      powerPlayByPlayer.get(
        powerPlayKey(
          player.name,
          player.team
        )
      );

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
                                <td className="p-2 tabular-nums" title={drafted ? "Drafted — not ranked among available players" : "Overall available recommendation rank"}>
                                  {drafted ? "—" : `#${overallRecommendationRanks.get(player.id)}`}
                                </td>
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

                                <td className="p-2">
                                  <PowerPlayBadge assignment={powerPlay} />
                                </td>

                                <td className="p-2 font-black text-emerald-400">
                                  {player.score.toFixed(
                                    2
                                  )}
                                </td>

                                <td className="p-2">
                                  <GoneRiskBadge
                                    reason={player.returnReason}
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
                                  title={!hasProjectionValue(player, 'age') ? 'Age unavailable; no age penalty' : 'Age is an uncertainty note; no additional score penalty'}
                                >
                                  {
                                    hasProjectionValue(player, 'age') ? player.age : '—'
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
                  </>
                )}
              </div>

              <aside className="xl:sticky xl:top-[84px] xl:self-start">
              {activePool==="skaters" && selectedPlayer && (
  <section className="mb-4">
    <PlayerExplanationCard
      player={finalRankedPlayers.find(p=>p.id===selectedPlayer.id)??selectedPlayer}
      powerPlayAssignment={powerPlayByPlayer.get(powerPlayKey(selectedPlayer.name,selectedPlayer.team))}
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
                        skaters · {myGoalieCount}/2 goalies
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

                  <p className="mt-4 text-xs text-zinc-500">Roster profile · descriptive only; not an added score bonus</p>
                  <div className="mt-2 grid grid-cols-7 gap-1">
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
                            {draftPicks.filter(p=>p.fantasyTeamId===team.id).length}{" "}
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

function GoneRiskBadge({
  level,
  reason,
}: {
  level: ReturnRiskLevel;
  reason: string;
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
        reason
      }
    >
      {level}
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
            Points standard deviation:
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
              "Wide point spread or limited data; not calibrated accuracy."}
          </div>
  
        </div>
      </details>
    );
  }

  function formatReturnDate(
    date?: string | null
  ) {
    if (!date) {
      return null;
    }
  
    const parsed =
      new Date(
        `${date}T00:00:00`
      );
  
    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {
      return date;
    }
  
    return parsed.toLocaleDateString(
      "en-CA",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
      }
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
  ? `Return: ${formatReturnDate(
      injury.returnDate
    )}`
  : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      >
        {label}
      </span>
    );
  }
