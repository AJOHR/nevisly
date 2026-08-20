type Player = {
    id: string;
    score: number;
    positions: string[];
  };
  
  type DraftPick = {
    playerId: string;
    pickNumber: number;
  };
  
  export type ReturnRiskLevel =
    | "SAFE"
    | "POSSIBLE"
    | "RISKY"
    | "TAKE NOW";
  
  export function calculateReturnRisk({
    player,
    allPlayers,
    draftPicks,
    leagueTeams,
    myDraftSlot,
  }: {
    player: Player;
    allPlayers: Player[];
    draftPicks: DraftPick[];
    leagueTeams: number;
    myDraftSlot: number;
  }) {
    const draftedIds = new Set(
      draftPicks.map(
        (pick) => pick.playerId
      )
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
  
    const available = [...allPlayers]
      .filter(
        (candidate) =>
          !draftedIds.has(candidate.id)
      )
      .sort(
        (a, b) =>
          b.score - a.score
      );
  
    const overallRank =
      available.findIndex(
        (candidate) =>
          candidate.id === player.id
      );
  
    if (overallRank === -1) {
      return {
        level: "SAFE" as ReturnRiskLevel,
        picksUntilNext,
        playersAhead: 0,
      };
    }
  
    const playersAhead =
      overallRank;
  
    const buffer =
      picksUntilNext -
      playersAhead;
  
    let level: ReturnRiskLevel;
  
    if (buffer <= -6) {
      level = "SAFE";
    } else if (buffer <= -2) {
      level = "POSSIBLE";
    } else if (buffer <= 3) {
      level = "RISKY";
    } else {
      level = "TAKE NOW";
    }
  
    return {
      level,
      picksUntilNext,
      playersAhead,
    };
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
      let pick = currentPick + 1;
      pick <=
      currentPick + leagueTeams * 2;
      pick++
    ) {
      const roundIndex =
        Math.floor(
          (pick - 1) /
            leagueTeams
        );
  
      const positionInRound =
        (pick - 1) %
        leagueTeams;
  
      const teamNumber =
        roundIndex % 2 === 0
          ? positionInRound + 1
          : leagueTeams -
            positionInRound;
  
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