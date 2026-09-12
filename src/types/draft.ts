export type DraftPick = {
    playerId: string;
    fantasyTeamId: string;
    pickNumber: number;
    playerName?: string;
    nhlTeam?: string;
    positions?: string[];
    yahooPlayerId?: string;
    manualProjectionId?: string;
    source?: "manual" | "yahoo";
    resolution?: "matched" | "unresolved" | "ambiguous" | "goalie";

  };
  
  export type FantasyTeam = {
    id: string;
    name: string;
    isMyTeam: boolean;
  };
export type SyncMetadata = {
 draftSessionId?:string;
 lastSnapshotSequence:number;
 pickSequences:Record<string,number>;
 status:'LIVE'|'PARTIAL'|'ERROR';
 message:string;
 lastReceivedAt:number;
 lastSnapshotAt?:number;
};
