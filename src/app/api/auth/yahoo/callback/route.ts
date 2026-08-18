import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const savedState = request.cookies.get("yahoo_oauth_state")?.value;

  if (error) {
    return NextResponse.json(
      {
        success: false,
        error,
      },
      { status: 400 }
    );
  }

  if (!code) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing Yahoo authorization code.",
      },
      { status: 400 }
    );
  }

  if (!state || !savedState || state !== savedState) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid OAuth state.",
      },
      { status: 400 }
    );
  }

  const clientId = process.env.YAHOO_CLIENT_ID;
  const clientSecret = process.env.YAHOO_CLIENT_SECRET;
  const redirectUri = process.env.YAHOO_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      {
        success: false,
        error: "Yahoo OAuth environment variables are missing.",
      },
      { status: 500 }
    );
  }

  const credentials = Buffer.from(
    `${clientId}:${clientSecret}`
  ).toString("base64");

  const tokenResponse = await fetch(
    "https://api.login.yahoo.com/oauth2/get_token",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
      cache: "no-store",
    }
  );

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok) {
    return NextResponse.json(
      {
        success: false,
        error: "Yahoo token exchange failed.",
        details: tokenData,
      },
      { status: tokenResponse.status }
    );
  }

  const response = NextResponse.json({
    success: true,
    message: "Yahoo connected successfully!",
    tokenType: tokenData.token_type,
    expiresIn: tokenData.expires_in,
    hasAccessToken: Boolean(tokenData.access_token),
    hasRefreshToken: Boolean(tokenData.refresh_token),
  });

  // Temporary MVP storage.
  // We'll replace this with proper server-side session/database storage.
  response.cookies.set("yahoo_access_token", tokenData.access_token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: tokenData.expires_in,
    path: "/",
  });

  if (tokenData.refresh_token) {
    response.cookies.set("yahoo_refresh_token", tokenData.refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
  }

  response.cookies.delete("yahoo_oauth_state");

  return response;
}