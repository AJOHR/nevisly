import { randomBytes } from "crypto";
import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.YAHOO_CLIENT_ID;
  const redirectUri = process.env.YAHOO_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Yahoo OAuth environment variables are missing." },
      { status: 500 }
    );
  }

  const state = randomBytes(32).toString("hex");

  const yahooAuthUrl = new URL(
    "https://api.login.yahoo.com/oauth2/request_auth"
  );

  yahooAuthUrl.searchParams.set("client_id", clientId);
  yahooAuthUrl.searchParams.set("redirect_uri", redirectUri);
  yahooAuthUrl.searchParams.set("response_type", "code");
  yahooAuthUrl.searchParams.set("state", state);
  yahooAuthUrl.searchParams.set("language", "en-us");

  const response = NextResponse.redirect(yahooAuthUrl);

  response.cookies.set("yahoo_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });

  return response;
}