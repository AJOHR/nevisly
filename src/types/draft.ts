export type DraftPick = {
    playerId: string;
    fantasyTeamId: string;
    pickNumber: number;
    playerName?: string;
    nhlTeam?: string;
    positions?: string[];
    yahooPlayerId?: string;
    source?: "manual" | "yahoo";
    resolution?: "matched" | "unresolved" | "ambiguous" | "goalie";

  };
  
  export type FantasyTeam = {
    id: string;
    name: string;
    isMyTeam: boolean;
  };