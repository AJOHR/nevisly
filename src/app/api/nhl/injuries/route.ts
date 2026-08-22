import { NextResponse } from "next/server";

export const revalidate = 43200; // 12 hours

type InjuryPlayer = {
  id?: string;
  name?: string;
  team?: {
    abbreviation?: string;
    name?: string;
  };
};

type InjuryItem = {
  player?: InjuryPlayer;
  status?: string;
  injury_type?: string | null;
  return_date?: string | null;
};

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

    const rawInjuries =
      json?.data?.injuries ??
      [];

    const injuries =
      rawInjuries
        .map(
          (
            injury:
              InjuryItem
          ) => ({
            id:
              injury.player
                ?.id ??
              "",

            name:
              injury.player
                ?.name ??
              "",

            team:
              injury.player
                ?.team
                ?.abbreviation ??
              "",

            status:
              injury.status ??
              "unknown",

            injuryType:
              injury.injury_type ??
              null,

            returnDate:
              injury.return_date ??
              null,
          })
        )
        .filter(
          (
            injury: {
              name: string;
            }
          ) =>
            injury.name.length >
            0
        );

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