import { NextResponse } from "next/server";
import {
  DAILY_FACEOFF_TEAMS,
  parseDailyFaceoffPowerPlayPage,
  type PowerPlayTeamResult,
} from "@/lib/nhl/powerPlay";
import {
  POWER_PLAY_SNAPSHOT_CAPTURED_AT,
  powerPlaySnapshotTeam,
} from "@/data/powerPlaySnapshot";

export const revalidate = 21600; // 6 hours

function fallbackTeam(team: string, slug: string, reason: string): PowerPlayTeamResult {
  const snapshot = powerPlaySnapshotTeam(team);

  if (snapshot) {
    return {
      ...snapshot,
      slug,
      reason,
    };
  }

  return {
    team,
    slug,
    updatedAt: null,
    status: "unknown",
    reason,
    players: [],
  };
}

async function loadTeam(
  team: string,
  slug: string
): Promise<PowerPlayTeamResult> {
  try {
    const response = await fetch(
      `https://www.dailyfaceoff.com/teams/${slug}/line-combinations`,
      {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent":
            "Mozilla/5.0 (compatible; Nevisly/1.0; fantasy-hockey draft assistant)",
        },
        next: {
          revalidate,
        },
      }
    );

    if (!response.ok) {
      return fallbackTeam(team, slug, `snapshot-fallback:http-${response.status}`);
    }

    const parsed = parseDailyFaceoffPowerPlayPage(
      await response.text(),
      team,
      slug
    );

    if (parsed.status === "ok" && parsed.players.length > 0) {
      return parsed;
    }

    return fallbackTeam(team, slug, "snapshot-fallback:no-pp-data-parsed");
  } catch {
    return fallbackTeam(team, slug, "snapshot-fallback:fetch-error");
  }
}

export async function GET() {
  const teams = await Promise.all(
    DAILY_FACEOFF_TEAMS.map(([team, slug]) => loadTeam(team, slug))
  );

  const players = teams.flatMap((team) => team.players);
  const successfulTeams = teams.filter((team) => team.status === "ok").length;
  const snapshotTeams = teams.filter((team) =>
    team.players.some((player) => player.delivery === "snapshot")
  ).length;
  const liveTeams = teams.filter((team) =>
    team.players.some((player) => player.delivery === "live")
  ).length;

  return NextResponse.json({
    source: "Daily Faceoff",
    informationalOnly: true,
    fetchedAt: new Date().toISOString(),
    snapshotCapturedAt: POWER_PLAY_SNAPSHOT_CAPTURED_AT,
    successfulTeams,
    liveTeams,
    snapshotTeams,
    unknownTeams: teams.length - successfulTeams,
    teams,
    players,
  });
}
