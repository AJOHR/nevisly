import { inspectProjectionRows, projectionFields, type ProjectionField } from './quality';
import { projectionId, normalizePlayerName } from "./identity";
import Papa from "papaparse";
import type { SkaterProjection } from "@/types/player";

export function normalizeTeam(team: string) {
  const normalized = team
    .trim()
    .toUpperCase()
    .replace(/\./g, "");

  const map: Record<string, string> = {
    'DUCKS': 'ANA',
    'BRUINS': 'BOS',
    'SABRES': 'BUF',
    'FLAMES': 'CGY',
    'HURRICANES': 'CAR',
    'BLACKHAWKS': 'CHI',
    'AVALANCHE': 'COL',
    'BLUE JACKETS': 'CBJ',
    'STARS': 'DAL',
    'RED WINGS': 'DET',
    'OILERS': 'EDM',
    'PANTHERS': 'FLA',
    'KINGS': 'LAK',
    'WILD': 'MIN',
    'CANADIENS': 'MTL',
    'PREDATORS': 'NSH',
    'DEVILS': 'NJD',
    'ISLANDERS': 'NYI',
    'RANGERS': 'NYR',
    'SENATORS': 'OTT',
    'FLYERS': 'PHI',
    'PENGUINS': 'PIT',
    'KRAKEN': 'SEA',
    'SHARKS': 'SJS',
    'BLUES': 'STL',
    'LIGHTNING': 'TBL',
    'MAPLE LEAFS': 'TOR',
    'CANUCKS': 'VAN',
    'KNIGHTS': 'VGK',
    'GOLDEN KNIGHTS': 'VGK',
    'CAPITALS': 'WSH',
    'JETS': 'WPG',
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

function text(value: CsvValue) { return value == null ? '' : String(value).trim(); }
const headerKey = (value: string) => value.trim().toLowerCase().replace(/[\s_-]+/g, '');
const unavailable = (value: CsvValue) => /^(?:|n\/?a|null|undefined|unavailable|not available|[-–—])$/i.test(text(value));

/** Read all matching columns; never let duplicate headings overwrite a populated value. */
function getValues(headers: string[], row: string[], aliases: string[]) {
  const keys = new Set(aliases.map(headerKey));
  return row.filter((value, index) => keys.has(headers[index]) && !unavailable(value));
}
function getText(headers: string[], row: string[], aliases: string[], label: string) {
  const values = getValues(headers, row, aliases).map(text);
  if (new Set(values).size > 1) throw new Error(`Conflicting ${label} columns.`);
  return values[0] ?? '';
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

export function parseSkaterCsv(file: File | string): Promise<SkaterProjection[]> {
  return new Promise((resolve, reject) => {
    // Positional rows retain repeated GP and blank spacer headings without Papa's renaming.
    Papa.parse<string[]>(file as File, {
      header: false,
      skipEmptyLines: 'greedy',
      complete(results) {
        try {
          if (results.errors.length) throw new Error(`CSV error: ${results.errors[0].message}`);
          // Standard exports put headings first. FreshSheets Rankings exports include
          // title/configuration rows above the real PLAYER/TEAM/POS projection header.
          // Detect the first plausible projection header instead of requiring row 1.
          const headerIndex = results.data.findIndex(candidate => {
            const keys = candidate.map(value => headerKey(text(value)));
            const has = (names: string[]) => names.some(name => keys.includes(headerKey(name)));
            return has(['Player', 'Name', 'Player Name'])
              && has(['Team', 'Tm'])
              && has(['Pos', 'Position', 'Site Pos', 'Yahoo Pos', 'Yahoo Position'])
              && has(['G', 'Goals'])
              && has(['A', 'Assists'])
              && has(['PTS', 'Points', 'P']);
          });
          if (headerIndex < 0) throw new Error('CSV has no recognized projection header row.');
          const rawHeaders = results.data[headerIndex];
          const rows = results.data.slice(headerIndex + 1);
          const headers = rawHeaders.map(value => headerKey(text(value)));
          const players: SkaterProjection[] = [];
          for (const [index, row] of rows.entries()) {
            if (row.length !== headers.length) throw new Error(`CSV row ${index + headerIndex + 2}: expected ${headers.length} fields, found ${row.length}.`);
            const name = getText(headers, row, ['Player', 'Name', 'Player Name'], 'player name');
            if (!name) throw new Error(`CSV row ${index + headerIndex + 2}: missing player name.`);
            const team = normalizeTeam(getText(headers, row, ['Team', 'Tm'], `${name} team`));
            // Provider role F/D is less specific than explicit site eligibility.
            const position = getText(headers, row, ['Site Pos', 'Yahoo Pos', 'Yahoo Position'], `${name} site position`)
              || getText(headers, row, ['Pos', 'Position'], `${name} position`);
            const positions = [...new Set(position.split(/[,/|]/).map(normalizePosition).filter(Boolean))];
            if (positions.includes('G')) continue;
            if (!positions.length || positions.some(pos => !['C', 'LW', 'RW', 'D', 'F', 'W'].includes(pos))) {
              throw new Error(`${name}: missing or unsupported skater position.`);
            }
            const missingFields: ProjectionField[] = [];
            const values = {} as Record<ProjectionField, number>;
            for (const field of projectionFields) {
              const raw = getValues(headers, row, aliases[field]);
              if (!raw.length) { missingFields.push(field); values[field] = 0; continue; }
              const numbers = raw.map(value => Number(value));
              if (numbers.some(value => !Number.isFinite(value) || value < 0)) throw new Error(`${name}: invalid ${field} value "${raw.join(', ')}".`);
              if (new Set(numbers).size > 1) throw new Error(`${name}: conflicting ${field} columns; choose one projection column.`);
              values[field] = numbers[0];
            }
            players.push({ id: projectionId(name), name, team, positions, missingFields, ...values });
          }
          const checked = inspectProjectionRows(players);
          if (checked.warnings.length) throw new Error(checked.warnings.join(' '));
          resolve(checked.players);
        } catch (error) { reject(error); }
      },
      error: reject,
    });
  });
}
