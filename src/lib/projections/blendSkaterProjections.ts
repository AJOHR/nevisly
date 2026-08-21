import type { SkaterProjection } from "@/types/player";

import {
  getProjectionPlayerKey,
} from "@/lib/projections/parseSkaterCsv";

export type ProjectionSource = {
  id: string;
  name: string;
  weight: number;
  players: SkaterProjection[];
};

export type ProjectionSourceDiagnostic = {
  sourceId: string;
  sourceName: string;

  playerCount: number;

  matchedPlayers: number;
  uniquePlayers: number;

  matchPercentage: number;

  uniquePlayerNames: string[];
};

export type ProjectionDiagnostics = {
  activeSourceCount: number;

  totalUniquePlayers: number;

  matchedAcrossAllSources: number;

  matchedAcrossMultipleSources: number;

  sources: ProjectionSourceDiagnostic[];
};

const weightedFields = [
  "gp",
  "goals",
  "assists",
  "points",
  "ppp",
  "sog",
  "hits",
  "blocks",
] as const;

type WeightedField =
  (typeof weightedFields)[number];

type PlayerEntry = {
  source: ProjectionSource;
  player: SkaterProjection;
};

function normalizeTeam(team: string) {
    const map: Record<string, string> = {
        EDMONTON: "EDM",
        COLORADO: "COL",
        "TAMPA BAY": "TBL",
        TORONTO: "TOR",
        BOSTON: "BOS",
        VANCOUVER: "VAN",
        FLORIDA: "FLA",
        "NEW YORK RANGERS": "NYR",
        "NEW YORK ISLANDERS": "NYI",
        "NEW JERSEY": "NJD",
        WASHINGTON: "WSH",
      };
  
    const normalized =
      team.trim().toUpperCase();
  
    return map[normalized] ?? normalized;
  }

function getProjectionConfidence(
    sourceCount: number
  ):
    | "HIGH"
    | "MEDIUM"
    | "LOW" {
    if (sourceCount >= 2) {
      return "HIGH";
    }
  
    if (sourceCount === 1) {
      return "MEDIUM";
    }
  
    return "LOW";
  }

function round(
  value: number,
  decimals = 2
) {
  const factor =
    10 ** decimals;

  return (
    Math.round(
      value *
        factor
    ) /
    factor
  );
}

function getWeightedValue(
  entries: PlayerEntry[],
  field: WeightedField
) {
  const validEntries =
    entries.filter(
      (
        entry
      ) =>
        entry.source
          .weight >
        0
    );

  const totalWeight =
    validEntries.reduce(
      (
        total,
        entry
      ) =>
        total +
        entry.source
          .weight,
      0
    );

  if (
    totalWeight <=
    0
  ) {
    return 0;
  }

  const weightedTotal =
    validEntries.reduce(
      (
        total,
        entry
      ) =>
        total +
        entry.player[
          field
        ] *
          entry.source
            .weight,
      0
    );

  return round(
    weightedTotal /
      totalWeight
  );
}

function getPrimaryEntry(
  entries: PlayerEntry[]
) {
  return [
    ...entries,
  ].sort(
    (
      a,
      b
    ) =>
      b.source
        .weight -
      a.source
        .weight
  )[0];
}

function getCombinedPositions(
  entries: PlayerEntry[]
) {
  const positions =
    new Set<string>();

  for (
    const entry of
    entries
  ) {
    for (
      const position of
      entry.player
        .positions
    ) {
      positions.add(
        position
      );
    }
  }

  return [
    ...positions,
  ];
}

function buildPlayerMap(
  sources: ProjectionSource[]
) {
  const playerMap =
    new Map<
      string,
      PlayerEntry[]
    >();

  for (
    const source of
    sources
  ) {
    for (
      const player of
      source.players
    ) {
      const key =
        getProjectionPlayerKey(
          player
        );

      const current =
        playerMap.get(
          key
        ) ?? [];

      current.push({
        source,
        player,
      });

      playerMap.set(
        key,
        current
      );
    }
  }

  return playerMap;
}

/*
 * --------------------------------------------------------
 * PROJECTION MATCH DIAGNOSTICS
 * --------------------------------------------------------
 *
 * This does not change any player projections.
 *
 * It tells Nevisly how well the uploaded
 * projection sources are matching one another.
 */
export function getProjectionDiagnostics(
  sources: ProjectionSource[]
): ProjectionDiagnostics {
  const activeSources =
    sources.filter(
      (
        source
      ) =>
        source.weight >
          0 &&
        source.players
          .length >
          0
    );

  if (
    activeSources.length ===
    0
  ) {
    return {
      activeSourceCount:
        0,

      totalUniquePlayers:
        0,

      matchedAcrossAllSources:
        0,

      matchedAcrossMultipleSources:
        0,

      sources:
        [],
    };
  }

  const playerMap =
    buildPlayerMap(
      activeSources
    );

  let matchedAcrossAllSources =
    0;

  let matchedAcrossMultipleSources =
    0;

  for (
    const entries of
    playerMap.values()
  ) {
    const sourceIds =
      new Set(
        entries.map(
          (
            entry
          ) =>
            entry.source.id
        )
      );

    if (
      sourceIds.size >
      1
    ) {
      matchedAcrossMultipleSources++;
    }

    if (
      sourceIds.size ===
      activeSources.length
    ) {
      matchedAcrossAllSources++;
    }
  }

  const sourceDiagnostics =
    activeSources.map(
      (
        source
      ): ProjectionSourceDiagnostic => {
        let matchedPlayers =
          0;

        const uniquePlayerNames:
          string[] =
          [];

        for (
          const player of
          source.players
        ) {
          const key =
            getProjectionPlayerKey(
              player
            );

          const entries =
            playerMap.get(
              key
            ) ?? [];

          const otherSourceMatch =
            entries.some(
              (
                entry
              ) =>
                entry.source.id !==
                source.id
            );

          if (
            otherSourceMatch
          ) {
            matchedPlayers++;
          } else {
            uniquePlayerNames.push(
              player.name
            );
          }
        }

        const uniquePlayers =
          source.players.length -
          matchedPlayers;

        const matchPercentage =
          source.players.length >
          0
            ? round(
                (
                  matchedPlayers /
                  source.players.length
                ) *
                  100,
                1
              )
            : 0;

        return {
          sourceId:
            source.id,

          sourceName:
            source.name,

          playerCount:
            source.players.length,

          matchedPlayers,

          uniquePlayers,

          matchPercentage,

          uniquePlayerNames:
            uniquePlayerNames
              .sort(
                (
                  a,
                  b
                ) =>
                  a.localeCompare(
                    b
                  )
              ),
        };
      }
    );

  return {
    activeSourceCount:
      activeSources.length,

    totalUniquePlayers:
      playerMap.size,

    matchedAcrossAllSources,

    matchedAcrossMultipleSources,

    sources:
      sourceDiagnostics,
  };
}

/*
 * --------------------------------------------------------
 * BLEND PROJECTIONS
 * --------------------------------------------------------
 */
export function blendSkaterProjections(
  sources: ProjectionSource[]
): SkaterProjection[] {
  const activeSources =
    sources.filter(
      (
        source
      ) =>
        source.weight >
          0 &&
        source.players
          .length >
          0
    );

  if (
    activeSources.length ===
    0
  ) {
    return [];
  }

  /*
   * Preserve original single-source behavior.
   */
  if (
    activeSources.length ===
    1
  ) {
    return activeSources[
      0
    ].players;
  }

  const playerMap =
    buildPlayerMap(
      activeSources
    );

  const blended:
    SkaterProjection[] =
    [];

  for (
    const [
      key,
      entries,
    ] of
    playerMap
  ) {
    const primary =
      getPrimaryEntry(
        entries
      );

    if (
      !primary
    ) {
      continue;
    }

    const ageEntries =
      entries.filter(
        (
          entry
        ) =>
          entry.player
            .age >
          0
      );

    const age =
      ageEntries.length >
      0
        ? getWeightedAge(
            ageEntries
          )
        : primary
            .player
            .age;

    blended.push({
      id:
        `blend-${key}`,

      name:
        primary.player
          .name,

      age,

team:
  normalizeTeam(primary.player.team),

      positions:
        getCombinedPositions(
          entries
        ),

      gp:
        getWeightedValue(
          entries,
          "gp"
        ),

      goals:
        getWeightedValue(
          entries,
          "goals"
        ),

      assists:
        getWeightedValue(
          entries,
          "assists"
        ),

      points:
        getWeightedValue(
          entries,
          "points"
        ),

      ppp:
        getWeightedValue(
          entries,
          "ppp"
        ),

      sog:
        getWeightedValue(
          entries,
          "sog"
        ),

      hits:
        getWeightedValue(
          entries,
          "hits"
        ),

      blocks:
        getWeightedValue(
          entries,
          "blocks"
        ),

        projectionSources:
  entries.length,

projectionConfidence:
  getProjectionConfidence(
    entries.length
  ),
    });
  }

  return blended;
}

function getWeightedAge(
  entries: PlayerEntry[]
) {
  const totalWeight =
    entries.reduce(
      (
        total,
        entry
      ) =>
        total +
        entry.source
          .weight,
      0
    );

  if (
    totalWeight <=
    0
  ) {
    return (
      entries[0]
        ?.player.age ??
      0
    );
  }

  const weightedAge =
    entries.reduce(
      (
        total,
        entry
      ) =>
        total +
        entry.player
          .age *
          entry.source
            .weight,
      0
    ) /
    totalWeight;

  return round(
    weightedAge,
    1
  );
}