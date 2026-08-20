type Position = "C" | "LW" | "RW" | "D";

type CategoryKey =
  | "goals"
  | "assists"
  | "points"
  | "ppp"
  | "sog"
  | "hits"
  | "blocks";

type Player = {
  id: string;
  score: number;
  vor: number;
  positions: string[];

  zScores: Record<CategoryKey, number>;
};

type DraftPick = {
  playerId: string;
  fantasyTeamId: string;
  pickNumber: number;
};

type FantasyTeam = {
  id: string;
  isMyTeam: boolean;
};

export type ReturnRiskLevel =
  | "SAFE"
  | "POSSIBLE"
  | "RISKY"
  | "TAKE NOW";

export type ReturnRiskResult = {
  level: ReturnRiskLevel;

  probability: number;

  picksUntilNext: number;

  interestedTeams: number;

  teamsBeforeNextPick: number;

  reason: string;
};

const STARTER_NEEDS: Record<
  Position,
  number
> = {
  C: 2,
  LW: 2,
  RW: 2,
  D: 4,
};

const POSITION_SCARCITY_WEIGHT: Record<
  Position,
  number
> = {
  C: 0.85,
  LW: 1,
  RW: 1,
  D: 1.15,
};

const categoryKeys: CategoryKey[] = [
  "goals",
  "assists",
  "points",
  "ppp",
  "sog",
  "hits",
  "blocks",
];

export function calculateReturnRisk({
  player,
  allPlayers,
  draftPicks,
  fantasyTeams,
  leagueTeams,
  myDraftSlot,
}: {
  player: Player;
  allPlayers: Player[];
  draftPicks: DraftPick[];
  fantasyTeams: FantasyTeam[];
  leagueTeams: number;
  myDraftSlot: number;
}): ReturnRiskResult {
  const draftedIds = new Set(
    draftPicks.map(
      (pick) => pick.playerId
    )
  );

  const availablePlayers =
    allPlayers
      .filter(
        (candidate) =>
          !draftedIds.has(candidate.id)
      )
      .sort(
        (a, b) =>
          b.score - a.score
      );

  const currentPick =
    draftPicks.length + 1;

  const nextMyPick =
    findNextMyPick({
      currentPick,
      leagueTeams,
      myDraftSlot,
    });

  const picksUntilNext =
    Math.max(
      0,
      nextMyPick - currentPick
    );

  /*
   * If it is currently your pick,
   * we want to look at all teams
   * that draft before your NEXT turn.
   */
  const upcomingTeamIds =
    getTeamsBeforeNextPick({
      currentPick,
      nextMyPick,
      leagueTeams,
      myDraftSlot,
    });

  const playerMap =
    new Map(
      allPlayers.map(
        (candidate) => [
          candidate.id,
          candidate,
        ]
      )
    );

  const teamRosters =
    buildTeamRosters({
      fantasyTeams,
      draftPicks,
      playerMap,
    });

  const playerRank =
    availablePlayers.findIndex(
      (candidate) =>
        candidate.id === player.id
    );

  /*
   * Base likelihood from overall board position.
   *
   * If 15 teams pick before you and the
   * candidate is currently ranked 4th,
   * there is naturally substantial risk.
   */
  let baseProbability = 0;

  if (picksUntilNext > 0) {
    const expectedTakenWindow =
      picksUntilNext;

    if (
      playerRank <
      expectedTakenWindow * 0.35
    ) {
      baseProbability = 0.72;
    } else if (
      playerRank <
      expectedTakenWindow * 0.7
    ) {
      baseProbability = 0.55;
    } else if (
      playerRank <
      expectedTakenWindow
    ) {
      baseProbability = 0.4;
    } else if (
      playerRank <
      expectedTakenWindow * 1.4
    ) {
      baseProbability = 0.22;
    } else {
      baseProbability = 0.1;
    }
  }

  /*
   * Estimate which upcoming teams
   * would actually be interested.
   */
  let interestedTeams = 0;
  let totalInterest = 0;

  for (
    const teamId of
    upcomingTeamIds
  ) {
    const roster =
      teamRosters.get(teamId) ?? [];

    const interest =
      calculateTeamInterest({
        player,
        roster,
        availablePlayers,
      });

    totalInterest += interest;

    if (interest >= 0.55) {
      interestedTeams += 1;
    }
  }

  const averageInterest =
    upcomingTeamIds.length > 0
      ? totalInterest /
        upcomingTeamIds.length
      : 0;

  /*
   * Convert individual opponent interest
   * into probability that AT LEAST ONE
   * team selects the player.
   *
   * This is deliberately approximate.
   */
  const opponentPressure =
    1 -
    Math.pow(
      1 -
        Math.min(
          averageInterest,
          0.8
        ),
      Math.max(
        upcomingTeamIds.length,
        1
      )
    );

  /*
   * Blend board rank + opponent fit.
   *
   * Opponent behavior matters more,
   * but generic ranking still provides
   * useful draft-room context.
   */
  let probability =
    baseProbability * 0.4 +
    opponentPressure * 0.6;

  /*
   * Premium players should naturally
   * be more likely to disappear.
   */
  if (player.vor >= 2) {
    probability += 0.07;
  } else if (
    player.vor >= 1
  ) {
    probability += 0.04;
  }

  if (
    playerRank >= 0 &&
    picksUntilNext > 0 &&
    playerRank < Math.max(3, picksUntilNext * 0.25)
  ) {
    probability = 1;
  }
  
  probability =
  Math.max(
    0,
    Math.min(
      1,
      probability
    )
  );

  const percentage =
    probability * 100;

  let level: ReturnRiskLevel;

  if (percentage >= 75) {
    level = "TAKE NOW";
  } else if (
    percentage >= 55
  ) {
    level = "RISKY";
  } else if (
    percentage >= 30
  ) {
    level = "POSSIBLE";
  } else {
    level = "SAFE";
  }

  let reason: string;

  if (
    interestedTeams >= 4
  ) {
    reason =
      `${interestedTeams} upcoming teams fit this player`;
  } else if (
    interestedTeams >= 2
  ) {
    reason =
      `${interestedTeams} teams before you may target him`;
  } else if (
    playerRank >= 0 &&
    playerRank <
      picksUntilNext
  ) {
    reason =
      "Ranks inside the expected pick window";
  } else {
    reason =
      "Reasonable chance he survives";
  }

  return {
    level,

    probability,

    picksUntilNext,

    interestedTeams,

    teamsBeforeNextPick:
      upcomingTeamIds.length,

    reason,
  };
}

function calculateTeamInterest({
  player,
  roster,
  availablePlayers,
}: {
  player: Player;
  roster: Player[];
  availablePlayers: Player[];
}) {
  let interest = 0.15;

  /*
   * POSITION NEED
   */
  let bestPositionNeed = 0;

  for (
    const rawPosition of
    player.positions
  ) {
    if (
      !isPosition(
        rawPosition
      )
    ) {
      continue;
    }

    const rosterCount =
      roster.filter(
        (rosterPlayer) =>
          rosterPlayer.positions.includes(
            rawPosition
          )
      ).length;

    const starterNeed =
      STARTER_NEEDS[
        rawPosition
      ];

    const remainingNeed =
      starterNeed -
      rosterCount;

    let needScore = 0;

    if (
      remainingNeed >= 2
    ) {
      needScore = 0.7;
    } else if (
      remainingNeed === 1
    ) {
      needScore = 0.5;
    } else if (
      remainingNeed === 0
    ) {
      needScore = 0.18;
    } else {
      needScore = 0.05;
    }

    needScore *=
      POSITION_SCARCITY_WEIGHT[
        rawPosition
      ];

    bestPositionNeed =
      Math.max(
        bestPositionNeed,
        needScore
      );
  }

  interest +=
    bestPositionNeed * 0.45;

  /*
   * CATEGORY FIT
   *
   * Calculate where the opponent roster
   * is currently weakest and whether this
   * candidate helps those categories.
   */
  if (
    roster.length > 0
  ) {
    const categoryTotals =
      {} as Record<
        CategoryKey,
        number
      >;

    for (
      const category of
      categoryKeys
    ) {
      categoryTotals[
        category
      ] =
        roster.reduce(
          (
            total,
            rosterPlayer
          ) =>
            total +
            rosterPlayer.zScores[
              category
            ],
          0
        ) /
        roster.length;
    }

    const weakestCategories =
      [...categoryKeys]
        .sort(
          (a, b) =>
            categoryTotals[a] -
            categoryTotals[b]
        )
        .slice(0, 3);

    let fit = 0;

    for (
      const category of
      weakestCategories
    ) {
      const z =
        player.zScores[
          category
        ];

      if (z >= 1) {
        fit += 0.18;
      } else if (
        z >= 0.35
      ) {
        fit += 0.1;
      }
    }

    interest +=
      Math.min(
        fit,
        0.35
      );
  }

  /*
   * PLAYER QUALITY
   */
  const availableRank =
    availablePlayers.findIndex(
      (candidate) =>
        candidate.id === player.id
    );

  if (
    availableRank >= 0
  ) {
    if (
      availableRank <= 5
    ) {
      interest += 0.28;
    } else if (
      availableRank <= 12
    ) {
      interest += 0.2;
    } else if (
      availableRank <= 24
    ) {
      interest += 0.1;
    }
  }

  /*
   * Elite VOR is difficult for any team
   * to ignore even if position isn't
   * a perfect fit.
   */
  if (
    player.vor >= 2
  ) {
    interest += 0.18;
  } else if (
    player.vor >= 1
  ) {
    interest += 0.1;
  }

  return Math.max(
    0.02,
    Math.min(
      0.88,
      interest
    )
  );
}

function buildTeamRosters({
  fantasyTeams,
  draftPicks,
  playerMap,
}: {
  fantasyTeams: FantasyTeam[];
  draftPicks: DraftPick[];
  playerMap: Map<
    string,
    Player
  >;
}) {
  const result =
    new Map<
      string,
      Player[]
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

  for (
    const pick of
    draftPicks
  ) {
    const player =
      playerMap.get(
        pick.playerId
      );

    if (!player) {
      continue;
    }

    result
      .get(
        pick.fantasyTeamId
      )
      ?.push(
        player
      );
  }

  return result;
}

function getTeamsBeforeNextPick({
  currentPick,
  nextMyPick,
  leagueTeams,
  myDraftSlot,
}: {
  currentPick: number;
  nextMyPick: number;
  leagueTeams: number;
  myDraftSlot: number;
}) {
  const teamIds: string[] =
    [];

  for (
    let pick =
      currentPick + 1;
    pick < nextMyPick;
    pick++
  ) {
    const teamNumber =
      getTeamNumberForPick(
        pick,
        leagueTeams
      );

    if (
      teamNumber ===
      myDraftSlot
    ) {
      continue;
    }

    teamIds.push(
      `team-${teamNumber}`
    );
  }

  /*
   * A team can have two consecutive picks
   * at the snake turn. Keep both because
   * two selections means two chances that
   * player disappears.
   */
  return teamIds;
}

function findNextMyPick({
  currentPick,
  leagueTeams,
  myDraftSlot,
}: {
  currentPick: number;
  leagueTeams: number;
  myDraftSlot: number;
}) {
  for (
    let pick =
      currentPick + 1;
    pick <=
      currentPick +
        leagueTeams * 2;
    pick++
  ) {
    const teamNumber =
      getTeamNumberForPick(
        pick,
        leagueTeams
      );

    if (
      teamNumber ===
      myDraftSlot
    ) {
      return pick;
    }
  }

  return (
    currentPick +
    leagueTeams
  );
}

function getTeamNumberForPick(
  pickNumber: number,
  leagueTeams: number
) {
  const roundIndex =
    Math.floor(
      (pickNumber - 1) /
        leagueTeams
    );

  const positionInRound =
    (pickNumber - 1) %
    leagueTeams;

  return roundIndex % 2 ===
    0
    ? positionInRound + 1
    : leagueTeams -
        positionInRound;
}

function isPosition(
  position: string
): position is Position {
  return (
    position === "C" ||
    position === "LW" ||
    position === "RW" ||
    position === "D"
  );
}