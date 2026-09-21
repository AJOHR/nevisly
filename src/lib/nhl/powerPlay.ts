export type PowerPlayUnit = "PP1" | "PP2";

export type PowerPlayAssignment = {
  name: string;
  team: string;
  unit: PowerPlayUnit;
  updatedAt: string | null;
  source: "Daily Faceoff";
};

export type PowerPlayTeamResult = {
  team: string;
  slug: string;
  updatedAt: string | null;
  status: "ok" | "unknown";
  players: PowerPlayAssignment[];
};

export const DAILY_FACEOFF_TEAMS = [
  ["ANA", "anaheim-ducks"],
  ["BOS", "boston-bruins"],
  ["BUF", "buffalo-sabres"],
  ["CGY", "calgary-flames"],
  ["CAR", "carolina-hurricanes"],
  ["CHI", "chicago-blackhawks"],
  ["COL", "colorado-avalanche"],
  ["CBJ", "columbus-blue-jackets"],
  ["DAL", "dallas-stars"],
  ["DET", "detroit-red-wings"],
  ["EDM", "edmonton-oilers"],
  ["FLA", "florida-panthers"],
  ["LAK", "los-angeles-kings"],
  ["MIN", "minnesota-wild"],
  ["MTL", "montreal-canadiens"],
  ["NSH", "nashville-predators"],
  ["NJD", "new-jersey-devils"],
  ["NYI", "new-york-islanders"],
  ["NYR", "new-york-rangers"],
  ["OTT", "ottawa-senators"],
  ["PHI", "philadelphia-flyers"],
  ["PIT", "pittsburgh-penguins"],
  ["SJS", "san-jose-sharks"],
  ["SEA", "seattle-kraken"],
  ["STL", "st-louis-blues"],
  ["TBL", "tampa-bay-lightning"],
  ["TOR", "toronto-maple-leafs"],
  ["UTA", "utah-mammoth"],
  ["VAN", "vancouver-canucks"],
  ["VGK", "vegas-golden-knights"],
  ["WSH", "washington-capitals"],
  ["WPG", "winnipeg-jets"],
] as const;

const TEAM_ALIASES: Record<string, string> = {
  CLB: "CBJ",
  CBJ: "CBJ",
  LA: "LAK",
  LAA: "LAK",
  LAK: "LAK",
  MON: "MTL",
  MTL: "MTL",
  NJ: "NJD",
  NJD: "NJD",
  SJ: "SJS",
  SJS: "SJS",
  TB: "TBL",
  TBL: "TBL",
  UTAH: "UTA",
  UTA: "UTA",
  VEG: "VGK",
  VGK: "VGK",
  WAS: "WSH",
  WSH: "WSH",
};

export function normalizePowerPlayTeam(team: string) {
  const normalized = team.trim().toUpperCase().replace(/[^A-Z]/g, "");
  return TEAM_ALIASES[normalized] ?? normalized;
}

export function normalizePowerPlayPlayerName(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function powerPlayKey(name: string, team: string) {
  return `${normalizePowerPlayPlayerName(name)}|${normalizePowerPlayTeam(team)}`;
}

function decodeHtml(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    quot: '"',
    lt: "<",
    gt: ">",
    nbsp: " ",
    rsquo: "'",
    lsquo: "'",
    ldquo: '"',
    rdquo: '"',
    ndash: "-",
    mdash: "-",
  };

  return value
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(parseInt(code, 16))
    )
    .replace(/&([a-z]+);/gi, (entity, name: string) =>
      named[name.toLowerCase()] ?? entity
    );
}

function plainText(html: string) {
  return decodeHtml(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  ).replace(/\s+/g, " ");
}

function anchorLabels(html: string) {
  const labels: string[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = plainText(match[1]).trim();
    if (!label || label.length > 60 || /click player jersey/i.test(label)) {
      continue;
    }

    const key = normalizePowerPlayPlayerName(label);
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    labels.push(label);
  }

  return labels;
}

function extractUnitPlayers(
  html: string,
  startHeading: string,
  endHeading: string
) {
  const startPattern = new RegExp(startHeading, "ig");
  let startMatch: RegExpExecArray | null;

  while ((startMatch = startPattern.exec(html))) {
    const start = startMatch.index + startMatch[0].length;
    const remaining = html.slice(start);
    const endMatch = new RegExp(endHeading, "i").exec(remaining);
    if (!endMatch) {
      continue;
    }

    const labels = anchorLabels(remaining.slice(0, endMatch.index));
    if (labels.length >= 3) {
      return labels.slice(0, 5);
    }
  }

  return [];
}

export function parseDailyFaceoffPowerPlayPage(
  html: string,
  team: string,
  slug = ""
): PowerPlayTeamResult {
  const text = plainText(html);
  const updatedMatch = text.match(
    /Last updated:\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)/i
  );
  const updatedAt = updatedMatch?.[1] ?? null;

  const pp1 = extractUnitPlayers(
    html,
    "1st\\s*Powerplay\\s*Unit",
    "2nd\\s*Powerplay\\s*Unit"
  );
  const pp2 = extractUnitPlayers(
    html,
    "2nd\\s*Powerplay\\s*Unit",
    "1st\\s*Penalty\\s*Kill\\s*Unit"
  );

  const normalizedTeam = normalizePowerPlayTeam(team);
  const players: PowerPlayAssignment[] = [
    ...pp1.map((name) => ({
      name,
      team: normalizedTeam,
      unit: "PP1" as const,
      updatedAt,
      source: "Daily Faceoff" as const,
    })),
    ...pp2.map((name) => ({
      name,
      team: normalizedTeam,
      unit: "PP2" as const,
      updatedAt,
      source: "Daily Faceoff" as const,
    })),
  ];

  return {
    team: normalizedTeam,
    slug,
    updatedAt,
    status: players.length > 0 ? "ok" : "unknown",
    players,
  };
}
