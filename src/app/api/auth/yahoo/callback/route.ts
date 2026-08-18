import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

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

  return NextResponse.json({
    success: true,
    message: "Yahoo authorization code received.",
    stateReceived: Boolean(state),
  });
}