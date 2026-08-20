const categoryKeys = [
    "goals",
    "assists",
    "points",
    "ppp",
    "sog",
    "hits",
    "blocks",
  ] as const;
  
  type H2HCategory = (typeof categoryKeys)[number];
  
  type LeaguePlayer = {
    id: string;
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
    isMyTeam: boolean;
  };
  
  type TeamTotals = Record<H2HCategory, number>;
  
  function getTeamTotals(
    players: LeaguePlayer[]
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
  
    for (const player of players) {
      for (const category of categoryKeys) {
        totals[category] += player[category];
      }
    }
  
    return totals;
  }
  
  function compareTeams(
    teamA: TeamTotals,
    teamB: TeamTotals
  ) {
    let categoryWins = 0;
  
    for (const category of categoryKeys) {
      if (teamA[category] > teamB[category]) {
        categoryWins += 1;
      } else if (teamA[category] === teamB[category]) {
        categoryWins += 0.5;
      }
    }
  
    return categoryWins;
  }
  
  function getAverageCategoryWins(
    myTeamId: string,
    fantasyTeams: FantasyTeam[],
    leagueTeamPlayers: Map<string, LeaguePlayer[]>
  ) {
    const myPlayers =
      leagueTeamPlayers.get(myTeamId) ?? [];
  
    const myTotals =
      getTeamTotals(myPlayers);
  
    const opponents = fantasyTeams.filter(
      (team) => team.id !== myTeamId
    );
  
    if (opponents.length === 0) {
      return 0;
    }
  
    let matchupTotal = 0;
  
    for (const opponent of opponents) {
      const opponentPlayers =
        leagueTeamPlayers.get(opponent.id) ?? [];
  
      const opponentTotals =
        getTeamTotals(opponentPlayers);
  
      matchupTotal += compareTeams(
        myTotals,
        opponentTotals
      );
    }
  
    return matchupTotal / opponents.length;
  }
  
  function matchupStrength(
    categoryWins: number
  ) {
    const winningThreshold = 4;
  
    if (categoryWins >= winningThreshold) {
      return (
        winningThreshold +
        (categoryWins - winningThreshold) * 1.35
      );
    }
  
    return categoryWins;
  }
  
  export function calculateH2HImpact({
    player,
    fantasyTeams,
    leagueTeamPlayers,
  }: {
    player: LeaguePlayer;
    fantasyTeams: FantasyTeam[];
    leagueTeamPlayers: Map<
      string,
      LeaguePlayer[]
    >;
  }) {
    const myTeam = fantasyTeams.find(
      (team) => team.isMyTeam
    );
  
    if (!myTeam) {
      return {
        matchupGain: 0,
        beforeWins: 0,
        afterWins: 0,
      };
    }
  
    const beforeWins =
      getAverageCategoryWins(
        myTeam.id,
        fantasyTeams,
        leagueTeamPlayers
      );
  
    const simulated =
      new Map<string, LeaguePlayer[]>();
  
    for (const team of fantasyTeams) {
      simulated.set(
        team.id,
        [
          ...(leagueTeamPlayers.get(team.id) ?? []),
        ]
      );
    }
  
    simulated.set(
      myTeam.id,
      [
        ...(simulated.get(myTeam.id) ?? []),
        player,
      ]
    );
  
    const afterWins =
      getAverageCategoryWins(
        myTeam.id,
        fantasyTeams,
        simulated
      );
  
    const beforeStrength =
      matchupStrength(beforeWins);
  
    const afterStrength =
      matchupStrength(afterWins);
  
    return {
      matchupGain:
        afterStrength - beforeStrength,
      beforeWins,
      afterWins,
    };
  }