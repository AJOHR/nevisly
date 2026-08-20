export type WeekSchedule = {
    games: number;
    offNightGames: number;
  };
  
  export type TeamSchedule = {
    team: string;
  
    seasonGames: number;
    seasonOffNightGames: number;
  
    playoffGames: number;
    playoffOffNightGames: number;
  
    playoffByWeek: Record<
      string,
      WeekSchedule
    >;
  };
  
  export type PlayoffScheduleMap =
    Record<
      string,
      TeamSchedule
    >;
  
  export type ScheduleAverages = {
    seasonOffNightGames: number;
    playoffOffNightGames: number;
  };
  
  export function calculateScheduleBonus(
    schedule:
      | TeamSchedule
      | undefined,
  
    averages: ScheduleAverages
  ) {
    if (
      !schedule
    ) {
      return 0;
    }
  
    /*
     * --------------------------------------------------
     * SEASON OFF-NIGHT VALUE
     * --------------------------------------------------
     *
     * Reward teams with more usable off-night games
     * than the NHL average.
     *
     * Small effect because talent still dominates.
     */
    const seasonOffNightBonus =
      (
        schedule.seasonOffNightGames -
        averages.seasonOffNightGames
      ) *
      0.01;
  
    /*
     * --------------------------------------------------
     * PLAYOFF GAME VOLUME
     * --------------------------------------------------
     *
     * Rough baseline across three weeks = 9 games.
     */
    const playoffGamesBonus =
      (
        schedule.playoffGames -
        9
      ) *
      0.06;
  
    /*
     * --------------------------------------------------
     * PLAYOFF OFF-NIGHT VALUE
     * --------------------------------------------------
     *
     * More important than generic season off nights
     * because these games directly affect H2H survival.
     */
    const playoffOffNightBonus =
      (
        schedule.playoffOffNightGames -
        averages.playoffOffNightGames
      ) *
      0.025;
  
    /*
     * --------------------------------------------------
     * WEEKLY PLAYOFF BALANCE
     * --------------------------------------------------
     *
     * 4/3/4 is preferable to something like 5/5/1.
     */
    const weeklyGames = [
      schedule.playoffByWeek[
        "24"
      ]?.games ?? 0,
  
      schedule.playoffByWeek[
        "25"
      ]?.games ?? 0,
  
      schedule.playoffByWeek[
        "26"
      ]?.games ?? 0,
    ];
  
    const maxGames =
      Math.max(
        ...weeklyGames
      );
  
    const minGames =
      Math.min(
        ...weeklyGames
      );
  
    const spread =
      maxGames -
      minGames;
  
    let weeklyBalanceBonus =
      0;
  
    if (
      spread <=
      1
    ) {
      weeklyBalanceBonus =
        0.05;
    } else if (
      spread >=
      3
    ) {
      weeklyBalanceBonus =
        -0.05;
    }
  
    return clamp(
      seasonOffNightBonus +
        playoffGamesBonus +
        playoffOffNightBonus +
        weeklyBalanceBonus,
  
      -0.35,
      0.4
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