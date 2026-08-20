export type TeamPlayoffSchedule = {
    team: string;
  
    games: number;
  
    offNightGames: number;
  
    backToBacks: number;
  
    byWeek: Record<
      string,
      {
        games: number;
        offNightGames: number;
      }
    >;
  };
  
  export type PlayoffScheduleMap =
    Record<
      string,
      TeamPlayoffSchedule
    >;
  
  export function calculatePlayoffScheduleBonus(
    schedule:
      | TeamPlayoffSchedule
      | undefined
  ) {
    if (
      !schedule
    ) {
      return 0;
    }
  
    /*
     * Schedule is intentionally
     * only a tiebreaker.
     *
     * Expected 3-week baseline:
     * roughly 9 games.
     */
    const gameBonus =
      (schedule.games - 9) *
      0.07;
  
    /*
     * Off-night games are more
     * usable in a daily-lineup
     * league.
     */
    const offNightBonus =
      schedule.offNightGames *
      0.015;
  
    /*
     * For skaters, B2Bs get only
     * a tiny bump.
     *
     * They will matter more once
     * goalies are added.
     */
    const backToBackBonus =
      schedule.backToBacks *
      0.005;
  
    return clamp(
      gameBonus +
        offNightBonus +
        backToBackBonus,
      -0.25,
      0.3
    );
  }
  
  function clamp(
    value: number,
    minimum: number,
    maximum: number
  ) {
    return Math.max(
      minimum,
      Math.min(
        maximum,
        value
      )
    );
  }