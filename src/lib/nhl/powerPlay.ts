export type PowerPlayUnit = "PP1" | "PP2";

export type PowerPlayAssignment = {
  name: string;
  team: string;
  unit: PowerPlayUnit;
  updatedAt: string | null;
  source: "Daily Faceoff";
  delivery?: "live" | "snapshot";
  capturedAt?: string;
};

export type PowerPlayTeamResult = {
  team: string;
  slug: string;
  updatedAt: string | null;
  status: "ok" | "unknown";
  reason?: string;
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

function stripScriptsAndStyles(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
}

function plainText(html: string) {
  return decodeHtml(
    stripScriptsAndStyles(html).replace(/<[^>]+>/g, " ")
  ).replace(/\s+/g, " ");
}

function annotatedText(html: string) {
  const links: string[] = [];
  const withoutScripts = stripScriptsAndStyles(html);

  const withMarkers = withoutScripts.replace(
    /<a\b[^>]*>([\s\S]*?)<\/a>/gi,
    (_match, inner: string) => {
      const label = plainText(inner).trim();
      const index = links.push(label) - 1;
      return ` __DFO_LINK_${index}__ `;
    }
  );

  return {
    text: decodeHtml(withMarkers.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " "),
    links,
  };
}

function playerLinksFromSection(section: string, links: string[]) {
  const labels: string[] = [];
  const seen = new Set<string>();

  for (const match of section.matchAll(/__DFO_LINK_(\d+)__/g)) {
    const label = links[Number(match[1])]?.trim() ?? "";

    if (!label || label.length > 60 || /click player jersey/i.test(label)) {
      continue;
    }

    const key = normalizePowerPlayPlayerName(label);
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    labels.push(label);

    if (labels.length === 5) {
      break;
    }
  }

  return labels;
}

function extractUnitPlayers(
  text: string,
  links: string[],
  startHeading: RegExp,
  endHeading: RegExp
) {
  const startMatch = startHeading.exec(text);
  if (!startMatch) {
    return [];
  }

  const start = startMatch.index + startMatch[0].length;
  const remaining = text.slice(start);
  const endMatch = endHeading.exec(remaining);
  if (!endMatch) {
    return [];
  }

  return playerLinksFromSection(remaining.slice(0, endMatch.index), links);
}

export function parseDailyFaceoffPowerPlayPage(
  html: string,
  team: string,
  slug = ""
): PowerPlayTeamResult {
  const normalizedTeam = normalizePowerPlayTeam(team);
  const { text, links } = annotatedText(html);
  const updatedMatch = text.match(
    /Last updated:\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)/i
  );
  const updatedAt = updatedMatch?.[1] ?? null;

  const pp1 = extractUnitPlayers(
    text,
    links,
    /1st\s+Power\s*play\s+Unit/i,
    /2nd\s+Power\s*play\s+Unit/i
  );
  const pp2 = extractUnitPlayers(
    text,
    links,
    /2nd\s+Power\s*play\s+Unit/i,
    /1st\s+Penalty\s+Kill\s+Unit/i
  );

  const players: PowerPlayAssignment[] = [
    ...pp1.map((name) => ({
      name,
      team: normalizedTeam,
      unit: "PP1" as const,
      updatedAt,
      source: "Daily Faceoff" as const,
      delivery: "live" as const,
    })),
    ...pp2.map((name) => ({
      name,
      team: normalizedTeam,
      unit: "PP2" as const,
      updatedAt,
      source: "Daily Faceoff" as const,
      delivery: "live" as const,
    })),
  ];

  return {
    team: normalizedTeam,
    slug,
    updatedAt,
    status: players.length > 0 ? "ok" : "unknown",
    reason: players.length > 0 ? undefined : "no-pp-data-parsed",
    players,
  };
}
