import { NextResponse } from "next/server";
import { parseBigBallsInjuries } from "@/lib/nhl/injuries";

export const revalidate = 43200; // 12 hours

export async function GET() {
  const apiKey =
    process.env.BBS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "BBS_API_KEY is not configured.",
        injuries: [],
      },
      {
        status: 500,
      }
    );
  }

  try {
    const response =
      await fetch(
        "https://api.bigballsdata.com/v1/injuries?sport=ice_hockey",
        {
          headers: {
            "x-api-key":
              apiKey,
          },

          next: {
            revalidate:
              43200,
          },
        }
      );

    if (!response.ok) {
      const body =
        await response.text();

      return NextResponse.json(
        {
          error:
            `Injury API returned ${response.status}.`,

          details:
            body.slice(
              0,
              300
            ),

          injuries: [],
        },
        {
          status:
            response.status,
        }
      );
    }

    const json =
      await response.json();

    const injuries =
      parseBigBallsInjuries(
        json
      );

    if (injuries === null) {
      return NextResponse.json(
        {
          error:
            "Injury API returned an unexpected response shape.",
          injuries: [],
        },
        {
          status: 502,
        }
      );
    }

    return NextResponse.json({
      injuries,

      updatedAt:
        new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not load NHL injury data.",

        injuries: [],
      },
      {
        status: 500,
      }
    );
  }
}
