import { NextResponse } from "next/server";

const NHL_API =
  "https://api-web.nhle.com/v1/schedule";

/*
 * Yahoo 2026-27 fantasy season.
 *
 * Our league does NOT use Week 27.
 *
 * Usable fantasy season:
 * Sep 29, 2026 → Apr 4, 2027
 *
 * Playoffs:
 * Week 24: Mar 15-21
 * Week 25: Mar 22-28
 * Week 26: Mar 29-Apr 4
 */
const SEASON_START =
  "2026-09-29";

const SEASON_END =
  "2027-04-04";

const PLAYOFF_WEEKS = [
  {
    key: "24",
    start: "2027-03-15",
    end: "2027-03-21",
  },
  {
    key: "25",
    start: "2027-03-22",
    end: "2027-03-28",
  },
  {
    key: "26",
    start: "2027-03-29",
    end: "2027-04-04",
  },
] as const;

/*
 * Daily-lineup off nights.
 */
const OFF_NIGHT_DAYS =
  new Set([
    0, // Sunday
    1, // Monday
    3, // Wednesday
    5, // Friday
  ]);

type NHLTeam = {
  abbrev?: string;
};

type NHLGame = {
  id: number;

  gameType?: number;

  gameDate?: string;

  awayTeam?: NHLTeam;

  homeTeam?: NHLTeam;
};

type NHLGameDay = {
  date: string;

  games?: NHLGame[];
};

type NHLScheduleResponse = {
  gameWeek?: NHLGameDay[];
};

type WeekSchedule = {
  games: number;
  offNightGames: number;
};

type TeamSchedule = {
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

export async function GET() {
  try {
    const schedules =
      new Map<
        string,
        TeamSchedule
      >();

    const seenGames =
      new Set<number>();

    const seasonStart =
      parseDate(
        SEASON_START
      );

    const seasonEnd =
      parseDate(
        SEASON_END
      );

    if (
      !seasonStart ||
      !seasonEnd
    ) {
      throw new Error(
        "Invalid configured season dates."
      );
    }

    /*
     * NHL's schedule endpoint returns
     * a block of dates around the date
     * requested.
     *
     * Step through the season weekly
     * and dedupe games by NHL game ID.
     */
    let cursor =
      new Date(
        seasonStart
      );

    while (
      cursor <=
      seasonEnd
    ) {
      const dateString =
        formatDate(
          cursor
        );

      const response =
        await fetch(
          `${NHL_API}/${dateString}`,
          {
            next: {
              revalidate:
                60 *
                60 *
                24,
            },
          }
        );

      if (
        !response.ok
      ) {
        throw new Error(
          `NHL schedule request failed: ${response.status}`
        );
      }

      const data =
        (await response.json()) as NHLScheduleResponse;

      for (
        const day of
        data.gameWeek ??
        []
      ) {
        const dayDate =
          parseDate(
            day.date
          );

        if (
          !dayDate ||
          dayDate <
            seasonStart ||
          dayDate >
            seasonEnd
        ) {
          continue;
        }

        for (
          const game of
          day.games ??
          []
        ) {
          /*
           * NHL gameType 2 =
           * regular season.
           */
          if (
            game.gameType !==
              undefined &&
            game.gameType !==
              2
          ) {
            continue;
          }

          if (
            seenGames.has(
              game.id
            )
          ) {
            continue;
          }

          seenGames.add(
            game.id
          );

          const gameDate =
            game.gameDate
              ? parseDate(
                  game.gameDate
                )
              : dayDate;

          if (
            !gameDate
          ) {
            continue;
          }

          const teams = [
            game.awayTeam
              ?.abbrev,

            game.homeTeam
              ?.abbrev,
          ];

          for (
            const team of
            teams
          ) {
            if (
              !team
            ) {
              continue;
            }

            addGame({
              schedules,
              team,
              date:
                gameDate,
            });
          }
        }
      }

      cursor =
        addDays(
          cursor,
          7
        );
    }

    return NextResponse.json({
      seasonStart:
        SEASON_START,

      seasonEnd:
        SEASON_END,

      playoffWeeks:
        PLAYOFF_WEEKS,

      teams:
        Object.fromEntries(
          [
            ...schedules.entries(),
          ].sort(
            ([a], [b]) =>
              a.localeCompare(
                b
              )
          )
        ),
    });
  } catch (error) {
    console.error(
      error
    );

    return NextResponse.json(
      {
        error:
          "Could not load NHL schedule.",
      },
      {
        status: 500,
      }
    );
  }
}

function addGame({
  schedules,
  team,
  date,
}: {
  schedules: Map<
    string,
    TeamSchedule
  >;

  team: string;

  date: Date;
}) {
  const current =
    schedules.get(
      team
    ) ?? {
      team,

      seasonGames:
        0,

      seasonOffNightGames:
        0,

      playoffGames:
        0,

      playoffOffNightGames:
        0,

      playoffByWeek: {
        "24": {
          games: 0,
          offNightGames: 0,
        },

        "25": {
          games: 0,
          offNightGames: 0,
        },

        "26": {
          games: 0,
          offNightGames: 0,
        },
      },
    };

  const isOffNight =
    OFF_NIGHT_DAYS.has(
      date.getUTCDay()
    );

  /*
   * Season totals.
   *
   * This intentionally ends
   * Apr 4, so Week 27 is excluded.
   */
  current.seasonGames +=
    1;

  if (
    isOffNight
  ) {
    current.seasonOffNightGames +=
      1;
  }

  /*
   * Exact Yahoo playoff week.
   */
  const playoffWeek =
    getPlayoffWeek(
      date
    );

  if (
    playoffWeek
  ) {
    current.playoffGames +=
      1;

    current
      .playoffByWeek[
        playoffWeek
      ].games +=
      1;

    if (
      isOffNight
    ) {
      current.playoffOffNightGames +=
        1;

      current
        .playoffByWeek[
          playoffWeek
        ].offNightGames +=
        1;
    }
  }

  schedules.set(
    team,
    current
  );
}

function getPlayoffWeek(
  date: Date
) {
  for (
    const week of
    PLAYOFF_WEEKS
  ) {
    const start =
      parseDate(
        week.start
      );

    const end =
      parseDate(
        week.end
      );

    if (
      start &&
      end &&
      date >= start &&
      date <= end
    ) {
      return week.key;
    }
  }

  return null;
}

function parseDate(
  value: string
) {
  const date =
    new Date(
      `${value}T12:00:00Z`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date;
}

function formatDate(
  date: Date
) {
  return date
    .toISOString()
    .slice(0, 10);
}

function addDays(
  date: Date,
  days: number
) {
  const next =
    new Date(
      date
    );

  next.setUTCDate(
    next.getUTCDate() +
      days
  );

  return next;
}