type Player = {
    id: string;
    positions: string[];
    vor: number;
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
  
  type ScarcityResult = {
    scarcityBonus: number;
    reasons: string[];
  };
  
  const POSITION_WEIGHT: Record<string, number> = {
    C: 0.8,
    LW: 1.0,
    RW: 1.0,
    D: 1.15,
  };
  
  export function calculateDraftRoomScarcity({
    player,
    allPlayers,
    draftPicks,
    fantasyTeams,
  }: {
    player: Player;
    allPlayers: Player[];
    draftPicks: DraftPick[];
    fantasyTeams: FantasyTeam[];
  }): ScarcityResult {
    const draftedIds = new Set(
      draftPicks.map((pick) => pick.playerId)
    );
  
    const availablePlayers = allPlayers.filter(
      (p) => !draftedIds.has(p.id)
    );
  
    let totalBonus = 0;
    const reasons: string[] = [];
  
    for (const position of player.positions) {
      const positionWeight =
        POSITION_WEIGHT[position];
  
      if (!positionWeight) {
        continue;
      }
  
      const draftedAtPosition = draftPicks.filter(
        (pick) => {
          const draftedPlayer =
            allPlayers.find(
              (p) => p.id === pick.playerId
            );
  
          return draftedPlayer?.positions.includes(
            position
          );
        }
      ).length;
  
      const availableAtPosition =
        availablePlayers
          .filter((p) =>
            p.positions.includes(position)
          )
          .sort((a, b) => b.vor - a.vor);
  
      const playerIndex =
        availableAtPosition.findIndex(
          (p) => p.id === player.id
        );
  
      if (playerIndex === -1) {
        continue;
      }
  
      const nextPlayers =
        availableAtPosition.slice(
          playerIndex + 1,
          playerIndex + 5
        );
  
      const nextBestVor =
        nextPlayers.length > 0
          ? nextPlayers[0].vor
          : player.vor;
  
      const tierDrop =
        player.vor - nextBestVor;
  
      const totalLeaguePicks =
        draftPicks.length;
  
      const leagueSize =
        fantasyTeams.length;
  
      const expectedPositionShare =
        position === "D"
          ? 4 / 10
          : 2 / 10;
  
      const expectedDrafted =
        totalLeaguePicks *
        expectedPositionShare;
  
      const runPressure =
        expectedDrafted > 0
          ? draftedAtPosition /
            expectedDrafted
          : 0;
  
      let positionBonus = 0;
  
      /*
       * Tier cliff:
       * reward a player if value falls off
       * materially after him.
       */
      if (tierDrop >= 1.5) {
        positionBonus += 0.35;
        reasons.push(
          `${position} tier cliff`
        );
      } else if (tierDrop >= 0.8) {
        positionBonus += 0.2;
      }
  
      /*
       * Draft-room run:
       * if this position is being drafted
       * faster than expected, add urgency.
       */
      if (runPressure >= 1.4) {
        positionBonus += 0.3;
        reasons.push(
          `${position} run developing`
        );
      } else if (runPressure >= 1.15) {
        positionBonus += 0.15;
      }
  
      /*
       * Remaining depth:
       * if the usable player pool is getting
       * thin, scarcity matters more.
       */
      const strongRemaining =
        availableAtPosition.filter(
          (p) => p.vor >= 0
        ).length;
  
      const roughStarterDemand =
        position === "D"
          ? leagueSize * 4
          : leagueSize * 2;
  
      const remainingRatio =
        roughStarterDemand > 0
          ? strongRemaining /
            roughStarterDemand
          : 1;
  
      if (remainingRatio <= 0.35) {
        positionBonus += 0.25;
        reasons.push(
          `${position} depth drying up`
        );
      } else if (remainingRatio <= 0.55) {
        positionBonus += 0.1;
      }
  
      totalBonus +=
        positionBonus *
        positionWeight;
    }
  
    return {
      scarcityBonus: Math.min(
        totalBonus,
        0.75
      ),
      reasons: [
        ...new Set(reasons),
      ].slice(0, 2),
    };
  }