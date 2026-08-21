import Papa from "papaparse";
import type { SkaterProjection } from "@/types/player";

function normalizeTeam(team: string) {
  const normalized = team
    .trim()
    .toUpperCase();

  const map: Record<string, string> = {
    ANAHEIM: "ANA",
    ANA: "ANA",

    ARIZONA: "ARI",
    ARI: "ARI",

    BOSTON: "BOS",
    BOS: "BOS",

    BUFFALO: "BUF",
    BUF: "BUF",

    CALGARY: "CGY",
    CGY: "CGY",

    CAROLINA: "CAR",
    CAR: "CAR",

    CHICAGO: "CHI",
    CHI: "CHI",

    COLORADO: "COL",
    COL: "COL",

    COLUMBUS: "CBJ",
    CLB: "CBJ",
    CBJ: "CBJ",

    DALLAS: "DAL",
    DAL: "DAL",

    DETROIT: "DET",
    DET: "DET",

    EDMONTON: "EDM",
    EDM: "EDM",

    FLORIDA: "FLA",
    FLA: "FLA",

    LOS_ANGELES: "LAK",
    "LOS ANGELES": "LAK",
    LA: "LAK",
    LAK: "LAK",

    MINNESOTA: "MIN",
    MIN: "MIN",

    MONTREAL: "MTL",
    MON: "MTL",
    MTL: "MTL",

    NASHVILLE: "NSH",
    NSH: "NSH",

    NEW_JERSEY: "NJD",
    "NEW JERSEY": "NJD",
    NJ: "NJD",
    NJD: "NJD",

    NEW_YORK_ISLANDERS: "NYI",
    "NEW YORK ISLANDERS": "NYI",
    NYI: "NYI",

    NEW_YORK_RANGERS: "NYR",
    "NEW YORK RANGERS": "NYR",
    NYR: "NYR",

    OTTAWA: "OTT",
    OTT: "OTT",

    PHILADELPHIA: "PHI",
    PHI: "PHI",

    PITTSBURGH: "PIT",
    PIT: "PIT",

    SEATTLE: "SEA",
    SEA: "SEA",

    SAN_JOSE: "SJS",
    "SAN JOSE": "SJS",
    SJ: "SJS",
    SJS: "SJS",

    ST_LOUIS: "STL",
    "ST. LOUIS": "STL",
    STL: "STL",

    TAMPA_BAY: "TBL",
    "TAMPA BAY": "TBL",
    TB: "TBL",
    TBL: "TBL",

    TORONTO: "TOR",
    TOR: "TOR",

    UTAH: "UTA",
    UTA: "UTA",

    VANCOUVER: "VAN",
    VAN: "VAN",

    VEGAS: "VGK",
    "VEGAS GOLDEN KNIGHTS": "VGK",
    VGK: "VGK",

    WASHINGTON: "WSH",
    WAS: "WSH",
    WSH: "WSH",

    WINNIPEG: "WPG",
    WPG: "WPG",
  };

  return map[normalized] ?? normalized;
}

type CsvValue =
  | string
  | number
  | undefined
  | null;

type ProjectionRow = Record<string, CsvValue>;

function num(value: CsvValue) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function text(value: CsvValue) {
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
  for (const alias of aliases) {
    if (
      row[alias] !== undefined &&
      row[alias] !== null &&
      text(row[alias]) !== ""
    ) {
      return row[alias];
    }
  }

  return undefined;
}

function normalizePosition(position: string) {
  const normalized = position
    .trim()
    .toUpperCase();

  if (
    normalized === "LEFT WING" ||
    normalized === "LEFTWING"
  ) {
    return "LW";
  }

  if (
    normalized === "RIGHT WING" ||
    normalized === "RIGHTWING"
  ) {
    return "RW";
  }

  if (
    normalized === "CENTRE" ||
    normalized === "CENTER"
  ) {
    return "C";
  }

  if (
    normalized === "DEFENCE" ||
    normalized === "DEFENSE" ||
    normalized === "DEFENCEMAN" ||
    normalized === "DEFENSEMAN"
  ) {
    return "D";
  }

  return normalized;
}

function normalizeName(name: string) {
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
  player: SkaterProjection
) {
  return player.name
    .toLowerCase()
    .replace(
      /[^a-z0-9]/g,
      ""
    );
}

export function parseSkaterCsv(
  file: File
): Promise<SkaterProjection[]> {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      Papa.parse<ProjectionRow>(
        file,
        {
          header: true,
          skipEmptyLines: true,

          transformHeader(header) {
            return header.trim();
          },

          complete(results) {
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

                    if (!name) {
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

                    const positions =
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
                      )
                        .split(/[,/|]/)
                        .map(normalizePosition)
                        .filter(Boolean);

                    return {
                      id:
                        `${normalizeName(
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

                      goals: num(
                        getValue(
                          row,
                          [
                            "Goals",
                            "G",
                            "goals",
                          ]
                        )
                      ),

                      assists: num(
                        getValue(
                          row,
                          [
                            "Assists",
                            "A",
                            "assists",
                          ]
                        )
                      ),

                      points: num(
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

                      hits: num(
                        getValue(
                          row,
                          [
                            "Hits",
                            "HIT",
                            "HITS",
                          ]
                        )
                      ),

                      blocks: num(
                        getValue(
                          row,
                          [
                            "BLK",
                            "Blocks",
                            "Blocked Shots",
                          ]
                        )
                      ),
                    } satisfies SkaterProjection;
                  }
                )
                .filter(
                  (
                    player
                  ): player is SkaterProjection =>
                    player !== null
                );

            resolve(players);
          },

          error(error) {
            reject(error);
          },
        }
      );
    }
  );
}