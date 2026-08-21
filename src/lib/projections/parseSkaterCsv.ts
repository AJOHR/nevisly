import Papa from "papaparse";
import type { SkaterProjection } from "@/types/player";

type CsvValue =
  | string
  | number
  | undefined
  | null;

type ProjectionRow = Record<
  string,
  CsvValue
>;

function num(
  value: CsvValue
) {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}

function text(
  value: CsvValue
) {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  return String(value).trim();
}

function getValue(
  row: ProjectionRow,
  aliases: string[]
) {
  for (
    const alias of
    aliases
  ) {
    if (
      row[alias] !==
        undefined &&
      row[alias] !==
        null &&
      text(
        row[alias]
      ) !== ""
    ) {
      return row[
        alias
      ];
    }
  }

  return undefined;
}

function normalizeTeam(
  team: string
) {
  const normalized =
    team
      .trim()
      .toUpperCase();

  const aliases:
    Record<
      string,
      string
    > = {
    TB: "TBL",
    LA: "LAK",
    NJ: "NJD",
    SJ: "SJS",
    WAS: "WSH",
    CLB: "CBJ",
    MON: "MTL",
  };

  return (
    aliases[
      normalized
    ] ??
    normalized
  );
}

function normalizePosition(
  position: string
) {
  const normalized =
    position
      .trim()
      .toUpperCase();

  if (
    normalized ===
      "LEFT WING" ||
    normalized ===
      "LEFTWING"
  ) {
    return "LW";
  }

  if (
    normalized ===
      "RIGHT WING" ||
    normalized ===
      "RIGHTWING"
  ) {
    return "RW";
  }

  if (
    normalized ===
      "CENTRE" ||
    normalized ===
      "CENTER"
  ) {
    return "C";
  }

  if (
    normalized ===
      "DEFENCE" ||
    normalized ===
      "DEFENSE" ||
    normalized ===
      "DEFENCEMAN" ||
    normalized ===
      "DEFENSEMAN"
  ) {
    return "D";
  }

  return normalized;
}

function normalizeName(
  name: string
) {
  return name
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[.’']/g,
      ""
    )
    .replace(
      /[-]/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim()
    .toLowerCase();
}

export function getProjectionPlayerKey(
  player: Pick<
    SkaterProjection,
    "name" | "team"
  >
) {
  return `${normalizeName(
    player.name
  )}|${normalizeTeam(
    player.team
  )}`;
}

export function parseSkaterCsv(
  file: File
): Promise<
  SkaterProjection[]
> {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      Papa.parse<ProjectionRow>(
        file,
        {
          header: true,
          skipEmptyLines:
            true,
          transformHeader:
            (
              header
            ) =>
              header.trim(),

          complete:
            (
              results
            ) => {
              const players =
                results.data
                  .map(
                    (
                      row,
                      index
                    ) => {
                      const name =
                        text(
                          getValue(
                            row,
                            [
                              "Player",
                              "Name",
                              "Player Name",
                              "PLAYER",
                              "player",
                              "name",
                            ]
                          )
                        );

                      if (
                        !name
                      ) {
                        return null;
                      }

                      const team =
                        normalizeTeam(
                          text(
                            getValue(
                              row,
                              [
                                "Team",
                                "TEAM",
                                "Tm",
                                "team",
                              ]
                            )
                          )
                        );

                      const positionText =
                        text(
                          getValue(
                            row,
                            [
                              "Pos",
                              "Position",
                              "POS",
                              "position",
                            ]
                          )
                        );

                      const positions =
                        positionText
                          .split(
                            /[,/|]/
                          )
                          .map(
                            (
                              position
                            ) =>
                              normalizePosition(
                                position
                              )
                          )
                          .filter(
                            Boolean
                          );

                      return {
                        id: `${normalizeName(
                          name
                        )}-${team}-${index}`,

                        name,

                        age: num(
                          getValue(
                            row,
                            [
                              "Age",
                              "AGE",
                              "age",
                            ]
                          )
                        ),

                        team,

                        positions,

                        gp: num(
                          getValue(
                            row,
                            [
                              "GP",
                              "Games",
                              "Games Played",
                            ]
                          )
                        ),

                        goals:
                          num(
                            getValue(
                              row,
                              [
                                "Goals",
                                "G",
                                "goals",
                              ]
                            )
                          ),

                        assists:
                          num(
                            getValue(
                              row,
                              [
                                "Assists",
                                "A",
                                "assists",
                              ]
                            )
                          ),

                        points:
                          num(
                            getValue(
                              row,
                              [
                                "Points",
                                "PTS",
                                "Pts",
                                "points",
                              ]
                            )
                          ),

                        ppp: num(
                          getValue(
                            row,
                            [
                              "PP Points",
                              "PPP",
                              "Power Play Points",
                              "Power-Play Points",
                            ]
                          )
                        ),

                        sog: num(
                          getValue(
                            row,
                            [
                              "SOG",
                              "Shots",
                              "Shots on Goal",
                              "Shots On Goal",
                            ]
                          )
                        ),

                        hits:
                          num(
                            getValue(
                              row,
                              [
                                "Hits",
                                "HIT",
                                "HITS",
                              ]
                            )
                          ),

                        blocks:
                          num(
                            getValue(
                              row,
                              [
                                "BLK",
                                "Blocks",
                                "Blocked Shots",
                              ]
                            )
                          ),
                      } satisfies
                        SkaterProjection;
                    }
                  )
                  .filter(
                    (
                      player
                    ): player is SkaterProjection =>
                      player !==
                      null
                  );

              resolve(
                players
              );
            },

          error:
            (
              error
            ) => {
              reject(
                error
              );
            },
        }
      );
    }
  );
}