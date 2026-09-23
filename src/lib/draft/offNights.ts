export const OFF_NIGHT_MAX_GAMES = 8;

/**
 * Hockey Bangers-style daily-lineup off night:
 * a date with 8 or fewer NHL games league-wide.
 */
export function isOffNightGameCount(gameCount:number) {
  return Number.isFinite(gameCount) && gameCount >= 0 && gameCount <= OFF_NIGHT_MAX_GAMES;
}
