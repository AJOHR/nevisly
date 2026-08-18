import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get("yahoo_access_token")?.value;

  if (!accessToken) {
    return NextResponse.json(
      {
        success: false,
        error: "Not connected to Yahoo.",
      },
      { status: 401 }
    );
  }

  const yahooUrl =
    "https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games;game_codes=nhl/leagues?format=json";

  const yahooResponse = await fetch(yahooUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const text = await yahooResponse.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    data = {
      rawResponse: text,
    };
  }

  if (!yahooResponse.ok) {
    return NextResponse.json(
      {
        success: false,
        status: yahooResponse.status,
        yahooResponse: data,
      },
      { status: yahooResponse.status }
    );
  }

  return NextResponse.json({
    success: true,
    data,
  });
}