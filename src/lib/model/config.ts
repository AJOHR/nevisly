export const categories = ['goals', 'assists', 'points', 'ppp', 'sog', 'hits', 'blocks'] as const;
export type Category = typeof categories[number];
export type CategoryValues = Record<Category, number>;
export type ModelConfig = {
  starters: Readonly<Record<string, number>>;
  goalieSlots: number;
  sharedBenchSlots: number;
  /** Reference depth at DEFAULT_LEAGUE_TEAMS; scales with configured league demand. */
  normalizationPool: number;
  fitWeight: number;
  /** Category saturation width, in one-player standard deviations. Not a probability. */
  categoryWidth: number;
  opponentPriorSlots: number;
  ownPriorSlots: number;
  unresolvedPriorSlots: number;
};
export const modelConfig: ModelConfig = {
  starters: {C: 2, LW: 2, RW: 2, D: 4}, goalieSlots: 2, sharedBenchSlots: 4,
  normalizationPool: 250,
  fitWeight: 1, categoryWidth: Math.sqrt(10), opponentPriorSlots: 10, ownPriorSlots: 4, unresolvedPriorSlots: 2,
};
export const categoryLabels: Record<Category,string> = {goals:'G',assists:'A',points:'P',ppp:'PPP',sog:'SOG',hits:'HIT',blocks:'BLK'};

/** Preserve real positional scarcity without letting the eventual positional fringe
 * dominate early-round value. This restores the pre-Stage-5 55/45 replacement mix. */
export const positionalReplacementWeight = 0.55;

export const rosterSelectionCapacity = Object.values(modelConfig.starters).reduce((sum,count)=>sum+count,0)+modelConfig.goalieSlots+modelConfig.sharedBenchSlots;
