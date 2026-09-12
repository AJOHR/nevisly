export type DraftPick = {
    /** Local selection identity; never a fabricated Yahoo player key. */
    selectionId?: string;
    /** Optional link to a projection, independent of selection identity. */
    projectionId?: string;
    /** Compatibility view key for existing recommendation consumers. */
    playerId: string;
    ownershipSource?: "yahoo" | "snake-inferred" | "manual";
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
 health?: {
  lastMessageAt: number;
  extraction: 'unverified';
  history: 'unverified' | 'gaps' | 'conflict';
  unmatchedSelections: number;
  projectionCollisions: number;
  missingPickNumbers: number[];
 };
 pickFingerprints?: Record<string,string>;
 lastSnapshotFingerprint?: string;
 draftSessionId?:string;
 lastSnapshotSequence:number;
 pickSequences:Record<string,number>;
 status:'LIVE'|'PARTIAL'|'ERROR';
 message:string;
 lastReceivedAt:number;
 lastSnapshotAt?:number;
};
