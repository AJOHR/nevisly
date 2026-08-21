import type { SkaterProjection } from "@/types/player";
import { getProjectionPlayerKey } from "@/lib/projections/parseSkaterCsv";

export type ProjectionSource = {
  id: string;
  name: string;
  weight: number;
  players: SkaterProjection[];
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
   * A single source behaves essentially
   * the same as the existing importer.
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
    new Map<
      string,
      PlayerEntry[]
    >();

  for (
    const source of
    activeSources
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
      id: `blend-${key}`,

      name:
        primary.player
          .name,

      age,

      team:
        primary.player
          .team,

      positions:
        getCombinedPositions(
          entries
        ),

      gp: getWeightedValue(
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

      ppp: getWeightedValue(
        entries,
        "ppp"
      ),

      sog: getWeightedValue(
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