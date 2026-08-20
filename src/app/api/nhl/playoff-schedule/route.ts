import { NextResponse } from "next/server";

const NHL_API =
  "https://api-web.nhle.com/v1/schedule";

const DEFAULT_START =
  "2027-03-15";

const DEFAULT_END =
  "2027-04-04";

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

type TeamSchedule = {
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

const OFF_NIGHT_DAYS =
  new Set([
    0, // Sunday
    1, // Monday
    3, // Wednesday
    5, // Friday
  ]);

export async function GET(
  request: Request
) {
  try {
    const url =
      new URL(request.url);

    const start =
      url.searchParams.get(
        "start"
      ) ??
      DEFAULT_START;

    const end =
      url.searchParams.get(
        "end"
      ) ??
      DEFAULT_END;

    const startDate =
      parseDate(start);

    const endDate =
      parseDate(end);

    if (
      !startDate ||
      !endDate ||
      startDate >
        endDate
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid playoff date range.",
        },
        {
          status: 400,
        }
      );
    }

    const schedule =
      new Map<
        string,
        TeamSchedule
      >();

    /*
     * NHL /schedule/{date}
     * returns a gameWeek.
     *
     * We step one week at
     * a time, while de-duping
     * games by game ID.
     */
    const gameIds =
      new Set<number>();

    let cursor =
      new Date(
        startDate
      );

    while (
      cursor <=
      endDate
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
                60 * 60 * 24,
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
        const gameDate =
          parseDate(
            day.date
          );

        if (
          !gameDate ||
          gameDate <
            startDate ||
          gameDate >
            endDate
        ) {
          continue;
        }

        for (
          const game of
          day.games ??
          []
        ) {
          /*
           * gameType 2 =
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
            gameIds.has(
              game.id
            )
          ) {
            continue;
          }

          gameIds.add(
            game.id
          );

          const away =
            game.awayTeam
              ?.abbrev;

          const home =
            game.homeTeam
              ?.abbrev;

          if (
            away
          ) {
            addGame({
              schedule,
              team: away,
              date:
                gameDate,
            });
          }

          if (
            home
          ) {
            addGame({
              schedule,
              team: home,
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

    /*
     * Calculate B2B sets after
     * all games are collected.
     */
    const teamGameDates =
      new Map<
        string,
        Date[]
      >();

    gameIds.clear();

    cursor =
      new Date(
        startDate
      );

    while (
      cursor <=
      endDate
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
                60 * 60 * 24,
            },
          }
        );

      const data =
        (await response.json()) as NHLScheduleResponse;

      for (
        const day of
        data.gameWeek ??
        []
      ) {
        const gameDate =
          parseDate(
            day.date
          );

        if (
          !gameDate ||
          gameDate <
            startDate ||
          gameDate >
            endDate
        ) {
          continue;
        }

        for (
          const game of
          day.games ??
          []
        ) {
          if (
            game.gameType !==
              undefined &&
            game.gameType !==
              2
          ) {
            continue;
          }

          if (
            gameIds.has(
              game.id
            )
          ) {
            continue;
          }

          gameIds.add(
            game.id
          );

          for (
            const team of [
              game.awayTeam
                ?.abbrev,
              game.homeTeam
                ?.abbrev,
            ]
          ) {
            if (
              !team
            ) {
              continue;
            }

            const dates =
              teamGameDates.get(
                team
              ) ?? [];

            dates.push(
              gameDate
            );

            teamGameDates.set(
              team,
              dates
            );
          }
        }
      }

      cursor =
        addDays(
          cursor,
          7
        );
    }

    for (
      const [
        team,
        dates,
      ] of
      teamGameDates
    ) {
      dates.sort(
        (a, b) =>
          a.getTime() -
          b.getTime()
      );

      let backToBacks =
        0;

      for (
        let index = 1;
        index <
        dates.length;
        index++
      ) {
        const difference =
          daysBetween(
            dates[
              index - 1
            ],
            dates[
              index
            ]
          );

        if (
          difference ===
          1
        ) {
          backToBacks +=
            1;
        }
      }

      const record =
        schedule.get(
          team
        );

      if (
        record
      ) {
        record.backToBacks =
          backToBacks;
      }
    }

    return NextResponse.json({
      start,
      end,

      teams:
        Object.fromEntries(
          [...schedule].sort(
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
          "Could not load NHL playoff schedule.",
      },
      {
        status: 500,
      }
    );
  }
}

function addGame({
  schedule,
  team,
  date,
}: {
  schedule: Map<
    string,
    TeamSchedule
  >;

  team: string;

  date: Date;
}) {
  const week =
    getWeekKey(
      date
    );

  const current =
    schedule.get(
      team
    ) ?? {
      team,
      games: 0,
      offNightGames: 0,
      backToBacks: 0,
      byWeek: {},
    };

  current.games +=
    1;

  if (
    OFF_NIGHT_DAYS.has(
      date.getUTCDay()
    )
  ) {
    current.offNightGames +=
      1;
  }

  if (
    !current.byWeek[
      week
    ]
  ) {
    current.byWeek[
      week
    ] = {
      games: 0,
      offNightGames: 0,
    };
  }

  current.byWeek[
    week
  ].games += 1;

  if (
    OFF_NIGHT_DAYS.has(
      date.getUTCDay()
    )
  ) {
    current.byWeek[
      week
    ].offNightGames +=
      1;
  }

  schedule.set(
    team,
    current
  );
}

function getWeekKey(
  date: Date
) {
  const monday =
    new Date(
      date
    );

  const day =
    monday.getUTCDay();

  const offset =
    day === 0
      ? -6
      : 1 - day;

  monday.setUTCDate(
    monday.getUTCDate() +
      offset
  );

  return formatDate(
    monday
  );
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

function daysBetween(
  first: Date,
  second: Date
) {
  return Math.round(
    (second.getTime() -
      first.getTime()) /
      86_400_000
  );
}