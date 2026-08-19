const categoryKeys = [
    "goals",
    "assists",
    "points",
    "ppp",
    "sog",
    "hits",
    "blocks",
  ] as const;
  
  export type StandingsCategory =
    (typeof categoryKeys)[number];
  
  type SkaterStats = Record<
    StandingsCategory,
    number
  >;
  
  type LeaguePlayer = SkaterStats & {
    id: string;
  };
  
  type FantasyTeam = {
    id: string;
    isMyTeam: boolean;
  };
  
  type LeagueTeamPlayers = Map<
    string,
    LeaguePlayer[]
  >;
  
  function getTeamTotals(
    players: LeaguePlayer[]
  ): SkaterStats {
    const totals: SkaterStats = {
      goals: 0,
      assists: 0,
      points: 0,
      ppp: 0,
      sog: 0,
      hits: 0,
      blocks: 0,
    };
  
    for (const player of players) {
      for (const category of categoryKeys) {
        totals[category] += player[category];
      }
    }
  
    return totals;
  }
  
  function calculateCategoryRotoPoints(
    teamTotals: Map<string, SkaterStats>,
    category: StandingsCategory
  ) {
    const sorted = [
      ...teamTotals.entries(),
    ].sort(
      (a, b) =>
        b[1][category] -
        a[1][category]
    );
  
    const teamCount = sorted.length;
  
    const result =
      new Map<string, number>();
  
    let index = 0;
  
    while (index < sorted.length) {
      const currentValue =
        sorted[index][1][category];
  
      let tieEnd = index;
  
      while (
        tieEnd + 1 <
          sorted.length &&
        sorted[tieEnd + 1][1][
          category
        ] === currentValue
      ) {
        tieEnd++;
      }
  
      let availablePoints = 0;
  
      for (
        let i = index;
        i <= tieEnd;
        i++
      ) {
        availablePoints +=
          teamCount - i;
      }
  
      const average =
        availablePoints /
        (tieEnd - index + 1);
  
      for (
        let i = index;
        i <= tieEnd;
        i++
      ) {
        result.set(
          sorted[i][0],
          average
        );
      }
  
      index = tieEnd + 1;
    }
  
    return result;
  }
  
  function calculateMyRotoPoints(
    fantasyTeams: FantasyTeam[],
    leagueTeamPlayers: LeagueTeamPlayers
  ) {
    const myTeam =
      fantasyTeams.find(
        (team) => team.isMyTeam
      );
  
    if (!myTeam) {
      return {
        total: 0,
        categories: {} as Record<
          StandingsCategory,
          number
        >,
      };
    }
  
    const teamTotals =
      new Map<string, SkaterStats>();
  
    for (const team of fantasyTeams) {
      const players =
        leagueTeamPlayers.get(
          team.id
        ) ?? [];
  
      teamTotals.set(
        team.id,
        getTeamTotals(players)
      );
    }
  
    const categoryPoints =
      {} as Record<
        StandingsCategory,
        number
      >;
  
    let total = 0;
  
    for (const category of categoryKeys) {
      const roto =
        calculateCategoryRotoPoints(
          teamTotals,
          category
        );
  
      const points =
        roto.get(myTeam.id) ?? 0;
  
      categoryPoints[category] =
        points;
  
      total += points;
    }
  
    return {
      total,
      categories:
        categoryPoints,
    };
  }
  
  export function calculateMarginalStandingsGain({
    player,
    fantasyTeams,
    leagueTeamPlayers,
  }: {
    player: LeaguePlayer;
    fantasyTeams: FantasyTeam[];
    leagueTeamPlayers: LeagueTeamPlayers;
  }) {
    const myTeam =
      fantasyTeams.find(
        (team) => team.isMyTeam
      );
  
    if (!myTeam) {
      return {
        totalGain: 0,
        categoryGains:
          {} as Record<
            StandingsCategory,
            number
          >,
      };
    }
  
    const before =
      calculateMyRotoPoints(
        fantasyTeams,
        leagueTeamPlayers
      );
  
    const simulated =
      new Map<
        string,
        LeaguePlayer[]
      >();
  
    for (const team of fantasyTeams) {
      simulated.set(
        team.id,
        [
          ...(leagueTeamPlayers.get(
            team.id
          ) ?? []),
        ]
      );
    }
  
    simulated.set(myTeam.id, [
      ...(simulated.get(myTeam.id) ??
        []),
      player,
    ]);
  
    const after =
      calculateMyRotoPoints(
        fantasyTeams,
        simulated
      );
  
    const categoryGains =
      {} as Record<
        StandingsCategory,
        number
      >;
  
    for (const category of categoryKeys) {
      categoryGains[category] =
        after.categories[category] -
        before.categories[category];
    }
  
    return {
      totalGain:
        after.total -
        before.total,
      categoryGains,
    };
  }