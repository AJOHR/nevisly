const categoryKeys = [
    "goals",
    "assists",
    "points",
    "ppp",
    "sog",
    "hits",
    "blocks",
  ] as const;
  
  type H2HCategory =
    (typeof categoryKeys)[number];
  
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
  
  type TeamTotals = Record<
    H2HCategory,
    number
  >;
  
  const LEAGUE_WEIGHT =
    0.6;
  
  const CONTENDER_WEIGHT =
    0.4;
  
  const CONTENDER_COUNT =
    3;
  
  /*
   * --------------------------------------------------------
   * TEAM TOTALS
   * --------------------------------------------------------
   */
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
  
    for (
      const player of
      players
    ) {
      for (
        const category of
        categoryKeys
      ) {
        totals[
          category
        ] +=
          player[
            category
          ];
      }
    }
  
    return totals;
  }
  
  /*
   * --------------------------------------------------------
   * PER-PICK NORMALIZATION
   * --------------------------------------------------------
   *
   * During a snake draft, one team may temporarily
   * have more drafted players than another.
   *
   * Comparing raw totals would unfairly reward the
   * team with the extra player.
   *
   * Instead, H2H impact compares average production
   * per drafted skater.
   *
   * Example:
   *
   * My Team = 5 players
   * Opponent = 4 players
   *
   * We compare:
   *
   * My Team totals / 5
   *
   * against:
   *
   * Opponent totals / 4
   *
   * This measures roster quality rather than
   * temporary roster quantity.
   */
  function getPerPickTotals(
    players: LeaguePlayer[]
  ): TeamTotals | null {
    if (
      players.length ===
      0
    ) {
      return null;
    }
  
    const totals =
      getTeamTotals(
        players
      );
  
    const normalized =
      {} as TeamTotals;
  
    for (
      const category of
      categoryKeys
    ) {
      normalized[
        category
      ] =
        totals[
          category
        ] /
        players.length;
    }
  
    return normalized;
  }
  
  /*
   * --------------------------------------------------------
   * CATEGORY MATCHUP
   * --------------------------------------------------------
   *
   * Category win = 1
   * Category tie = 0.5
   * Category loss = 0
   *
   * Maximum score:
   *
   * 7 / 7
   */
  function compareTeams(
    teamA: TeamTotals,
    teamB: TeamTotals
  ) {
    let categoryWins =
      0;
  
    for (
      const category of
      categoryKeys
    ) {
      if (
        teamA[
          category
        ] >
        teamB[
          category
        ]
      ) {
        categoryWins +=
          1;
      } else if (
        teamA[
          category
        ] ===
        teamB[
          category
        ]
      ) {
        categoryWins +=
          0.5;
      }
    }
  
    return categoryWins;
  }
  
  /*
   * Compare two drafted rosters after
   * normalizing both to production per pick.
   *
   * If either roster has zero skaters,
   * there is not enough information yet
   * for a meaningful matchup.
   */
  function comparePlayerGroups(
    teamAPlayers:
      LeaguePlayer[],
    teamBPlayers:
      LeaguePlayer[]
  ) {
    const teamA =
      getPerPickTotals(
        teamAPlayers
      );
  
    const teamB =
      getPerPickTotals(
        teamBPlayers
      );
  
    if (
      !teamA ||
      !teamB
    ) {
      return null;
    }
  
    return compareTeams(
      teamA,
      teamB
    );
  }
  
  /*
   * --------------------------------------------------------
   * AVERAGE H2H CATEGORY SCORE
   * --------------------------------------------------------
   *
   * Returns average category score against
   * the requested opponent set.
   *
   * Example:
   *
   * 4.6 means this roster averages the
   * equivalent of 4.6 category wins out of 7.
   */
  function getAverageCategoryWins(
    teamId: string,
    fantasyTeams:
      FantasyTeam[],
    leagueTeamPlayers:
      Map<
        string,
        LeaguePlayer[]
      >,
    opponentIds?:
      Set<string>
  ) {
    const teamPlayers =
      leagueTeamPlayers.get(
        teamId
      ) ??
      [];
  
    if (
      teamPlayers.length ===
      0
    ) {
      return 0;
    }
  
    let matchupTotal =
      0;
  
    let validOpponents =
      0;
  
    for (
      const opponent of
      fantasyTeams
    ) {
      if (
        opponent.id ===
        teamId
      ) {
        continue;
      }
  
      if (
        opponentIds &&
        !opponentIds.has(
          opponent.id
        )
      ) {
        continue;
      }
  
      const opponentPlayers =
        leagueTeamPlayers.get(
          opponent.id
        ) ??
        [];
  
      const matchup =
        comparePlayerGroups(
          teamPlayers,
          opponentPlayers
        );
  
      /*
       * Ignore teams that have not drafted
       * a skater yet.
       */
      if (
        matchup ===
        null
      ) {
        continue;
      }
  
      matchupTotal +=
        matchup;
  
      validOpponents++;
    }
  
    if (
      validOpponents ===
      0
    ) {
      return 0;
    }
  
    return (
      matchupTotal /
      validOpponents
    );
  }
  
  /*
   * --------------------------------------------------------
   * IDENTIFY STRONGEST OPPONENTS
   * --------------------------------------------------------
   *
   * Rank each active opponent by its normalized
   * average category score against the rest
   * of the active league.
   *
   * Then retain the strongest three.
   *
   * Importantly, this is calculated BEFORE
   * simulating the candidate player.
   *
   * That prevents the contender group itself
   * from changing merely because we simulated
   * one potential draft pick.
   */
  function getStrongestOpponentIds(
    myTeamId: string,
    fantasyTeams:
      FantasyTeam[],
    leagueTeamPlayers:
      Map<
        string,
        LeaguePlayer[]
      >
  ) {
    const activeOpponents =
      fantasyTeams.filter(
        (
          team
        ) => {
          if (
            team.id ===
            myTeamId
          ) {
            return false;
          }
  
          const players =
            leagueTeamPlayers.get(
              team.id
            ) ??
            [];
  
          return (
            players.length >
            0
          );
        }
      );
  
    const strengths =
      activeOpponents.map(
        (
          opponent
        ) => {
          const strength =
            getAverageCategoryWins(
              opponent.id,
              fantasyTeams,
              leagueTeamPlayers
            );
  
          return {
            id:
              opponent.id,
  
            strength,
          };
        }
      );
  
    strengths.sort(
      (
        a,
        b
      ) =>
        b.strength -
        a.strength
    );
  
    return strengths
      .slice(
        0,
        CONTENDER_COUNT
      )
      .map(
        (
          opponent
        ) =>
          opponent.id
      );
  }
  
  /*
   * --------------------------------------------------------
   * MATCHUP STRENGTH
   * --------------------------------------------------------
   *
   * Crossing the H2H winning threshold matters
   * more than simply piling onto categories
   * that are already comfortably won.
   *
   * 4 categories is the winning threshold
   * in a seven-skater-category matchup.
   */
  function matchupStrength(
    categoryWins: number
  ) {
    const winningThreshold =
      4;
  
    if (
      categoryWins >=
      winningThreshold
    ) {
      return (
        winningThreshold +
        (
          categoryWins -
          winningThreshold
        ) *
          1.35
      );
    }
  
    return categoryWins;
  }
  
  /*
   * --------------------------------------------------------
   * H2H IMPACT
   * --------------------------------------------------------
   *
   * Final H2H candidate value:
   *
   * 60% = improvement vs entire active league
   * 40% = improvement vs strongest opponents
   *
   * The contender portion stays internal.
   * The UI continues displaying one Nevisly score.
   */
  export function calculateH2HImpact({
    player,
    fantasyTeams,
    leagueTeamPlayers,
  }: {
    player:
      LeaguePlayer;
  
    fantasyTeams:
      FantasyTeam[];
  
    leagueTeamPlayers:
      Map<
        string,
        LeaguePlayer[]
      >;
  }) {
    const myTeam =
      fantasyTeams.find(
        (
          team
        ) =>
          team.isMyTeam
      );
  
    if (
      !myTeam
    ) {
      return {
        matchupGain:
          0,
  
        beforeWins:
          0,
  
        afterWins:
          0,
  
        leagueGain:
          0,
  
        contenderGain:
          0,
      };
    }
  
    /*
     * Identify contenders using the CURRENT
     * league state before adding the candidate.
     */
    const contenderIds =
      getStrongestOpponentIds(
        myTeam.id,
        fantasyTeams,
        leagueTeamPlayers
      );
  
    const contenderSet =
      new Set(
        contenderIds
      );
  
    /*
     * Whole-league strength before candidate.
     */
    const beforeWins =
      getAverageCategoryWins(
        myTeam.id,
        fantasyTeams,
        leagueTeamPlayers
      );
  
    /*
     * Contender-only strength before candidate.
     */
    const beforeContenderWins =
      contenderIds.length >
      0
        ? getAverageCategoryWins(
            myTeam.id,
            fantasyTeams,
            leagueTeamPlayers,
            contenderSet
          )
        : 0;
  
    /*
     * Clone current draft state and simulate
     * adding the candidate to My Team.
     */
    const simulated =
      new Map<
        string,
        LeaguePlayer[]
      >();
  
    for (
      const team of
      fantasyTeams
    ) {
      simulated.set(
        team.id,
        [
          ...(
            leagueTeamPlayers.get(
              team.id
            ) ??
            []
          ),
        ]
      );
    }
  
    simulated.set(
      myTeam.id,
      [
        ...(
          simulated.get(
            myTeam.id
          ) ??
          []
        ),
  
        player,
      ]
    );
  
    /*
     * Whole-league strength after candidate.
     */
    const afterWins =
      getAverageCategoryWins(
        myTeam.id,
        fantasyTeams,
        simulated
      );
  
    /*
     * Contender-only strength after candidate.
     *
     * Use the SAME contenders identified before
     * simulation so we're measuring candidate
     * impact against a fixed benchmark.
     */
    const afterContenderWins =
      contenderIds.length >
      0
        ? getAverageCategoryWins(
            myTeam.id,
            fantasyTeams,
            simulated,
            contenderSet
          )
        : 0;
  
    const beforeLeagueStrength =
      matchupStrength(
        beforeWins
      );
  
    const afterLeagueStrength =
      matchupStrength(
        afterWins
      );
  
    const leagueGain =
      afterLeagueStrength -
      beforeLeagueStrength;
  
    let contenderGain =
      0;
  
    if (
      contenderIds.length >
      0
    ) {
      const beforeContenderStrength =
        matchupStrength(
          beforeContenderWins
        );
  
      const afterContenderStrength =
        matchupStrength(
          afterContenderWins
        );
  
      contenderGain =
        afterContenderStrength -
        beforeContenderStrength;
    }
  
    /*
     * If there are not yet any active contenders,
     * fall back entirely to whole-league impact.
     */
    const matchupGain =
      contenderIds.length >
      0
        ? leagueGain *
            LEAGUE_WEIGHT +
          contenderGain *
            CONTENDER_WEIGHT
        : leagueGain;
  
    return {
      matchupGain,
  
      /*
       * Preserve the existing API expected by
       * ProjectionUpload.tsx.
       */
      beforeWins,
  
      afterWins,
  
      /*
       * Extra diagnostic values for future
       * development. Nothing needs to display
       * these in the UI right now.
       */
      leagueGain,
  
      contenderGain,
    };
  }