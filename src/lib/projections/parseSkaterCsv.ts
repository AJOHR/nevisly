import { inspectProjectionRows, projectionFields, type ProjectionField } from './quality';
import { projectionId, normalizePlayerName } from "./identity";
import Papa from "papaparse";
import type { SkaterProjection } from "@/types/player";

function normalizeTeam(team: string) {
  const normalized = team
    .trim()
    .toUpperCase()
    .replace(/\./g, "");

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
    "ST LOUIS": "STL",
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

export function getProjectionPlayerKey(player: SkaterProjection) { return normalizePlayerName(player.name); }

const aliases: Record<ProjectionField, string[]> = {
  age: ['Age', 'AGE', 'age'], gp: ['GP', 'Games', 'Games Played'],
  goals: ['Goals', 'G', 'goals'], assists: ['Assists', 'A', 'assists'],
  points: ['Points', 'PTS', 'Pts', 'P', 'points'],
  ppp: ['PP Points', 'PPP', 'Power Play Points', 'Power-Play Points'],
  sog: ['SOG', 'Shots', 'Shots on Goal', 'Shots On Goal'],
  hits: ['Hits', 'HIT', 'HITS'], blocks: ['BLK', 'Blocks', 'Blocked Shots'],
};

export function parseSkaterCsv(file: File): Promise<SkaterProjection[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<ProjectionRow>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: header => header.trim(),
      complete(results) {
        try {
          if (results.errors.length) throw new Error(`CSV error: ${results.errors[0].message}`);
          if (Object.keys(results.meta.renamedHeaders ?? {}).length) throw new Error('CSV contains duplicate column headers.');
          const players: SkaterProjection[] = [];
          for (const [index, row] of results.data.entries()) {
            const name = text(getValue(row, ['Player', 'Name', 'NAME', 'Player Name', 'PLAYER', 'player', 'name']));
            if (!name) throw new Error(`CSV row ${index + 2}: missing player name.`);
            const team = normalizeTeam(text(getValue(row, ['Team', 'TEAM', 'Tm', 'team'])));
            const positions = text(getValue(row, ['Pos', 'Position', 'POS', 'position']))
              .split(/[,/|]/).map(normalizePosition).filter(Boolean);
            if (positions.includes('G')) continue;
            if (!positions.length || positions.some(pos => !['C', 'LW', 'RW', 'D', 'F', 'W'].includes(pos))) {
              throw new Error(`${name}: missing or unsupported skater position.`);
            }
            const missingFields: ProjectionField[] = [];
            const values = {} as Record<ProjectionField, number>;
            for (const field of projectionFields) {
              const raw = getValue(row, aliases[field]);
              if (raw === undefined) { missingFields.push(field); values[field] = 0; continue; }
              const value = Number(raw);
              if (!Number.isFinite(value) || value < 0) throw new Error(`${name}: invalid ${field} value "${raw}".`);
              values[field] = value;
            }
            players.push({ id: projectionId(name), name, team, positions, missingFields, ...values });
          }
          const checked = inspectProjectionRows(players);
          // Reject the upload atomically: keep the previous source and make the correction explicit.
          if (checked.warnings.length) throw new Error(checked.warnings.join(' '));
          resolve(checked.players);
        } catch (error) { reject(error); }
      },
      error: reject,
    });
  });
}
