import { NextResponse } from "next/server";
import { cookies } from "next/headers";

type TestResult = {
  name: string;
  url: string;
  status: number | null;
  ok: boolean;
  body: unknown;
};

async function testYahooEndpoint(
  name: string,
  url: string,
  accessToken: string
): Promise<TestResult> {
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    const text = await response.text();

    let body: unknown = text;

    try {
      body = JSON.parse(text);
    } catch {
      // Yahoo may return XML/text for some errors.
    }

    return {
      name,
      url,
      status: response.status,
      ok: response.ok,
      body,
    };
  } catch (error) {
    return {
      name,
      url,
      status: null,
      ok: false,
      body:
        error instanceof Error
          ? error.message
          : "Unknown request error",
    };
  }
}

export async function GET() {
  const cookieStore = await cookies();

  /*
   * IMPORTANT:
   *
   * Use the same cookie name your Yahoo callback route uses
   * for the access token.
   *
   * If your existing callback uses a different name,
   * change "yahoo_access_token" below to match it.
   */
  const accessToken =
    cookieStore.get("yahoo_access_token")?.value;

  if (!accessToken) {
    return NextResponse.json(
      {
        success: false,
        message:
          "No Yahoo access token found. Connect to Yahoo first.",
      },
      {
        status: 401,
      }
    );
  }

  const endpoints = [
    {
      name: "Fantasy NHL Game",
      url:
        "https://fantasysports.yahooapis.com/fantasy/v2/games;game_codes=nhl?format=json",
    },

    {
      name: "Logged-In Fantasy User",
      url:
        "https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1?format=json",
    },

    {
      name: "Logged-In NHL Leagues",
      url:
        "https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games;game_codes=nhl/leagues?format=json",
    },
  ];

  const results = await Promise.all(
    endpoints.map((endpoint) =>
      testYahooEndpoint(
        endpoint.name,
        endpoint.url,
        accessToken
      )
    )
  );

  return NextResponse.json({
    success: true,
    message: "Yahoo Fantasy API diagnostic",
    results,
  });
}