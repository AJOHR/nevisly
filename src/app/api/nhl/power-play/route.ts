import { NextResponse } from "next/server";
import {
  DAILY_FACEOFF_TEAMS,
  parseDailyFaceoffPowerPlayPage,
  type PowerPlayTeamResult,
} from "@/lib/nhl/powerPlay";

export const revalidate = 21600; // 6 hours

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
      return {
        team,
        slug,
        updatedAt: null,
        status: "unknown",
        players: [],
      };
    }

    return parseDailyFaceoffPowerPlayPage(await response.text(), team, slug);
  } catch {
    return {
      team,
      slug,
      updatedAt: null,
      status: "unknown",
      players: [],
    };
  }
}

export async function GET() {
  const teams = await Promise.all(
    DAILY_FACEOFF_TEAMS.map(([team, slug]) => loadTeam(team, slug))
  );

  const players = teams.flatMap((team) => team.players);

  return NextResponse.json({
    source: "Daily Faceoff",
    informationalOnly: true,
    fetchedAt: new Date().toISOString(),
    teams,
    players,
  });
}
