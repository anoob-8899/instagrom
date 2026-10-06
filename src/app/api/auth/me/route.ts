import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, validateSessionToken } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  try {
    let token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!token) {
      const cookieHeader = req.headers.get("cookie");
      if (cookieHeader) {
        const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
        if (match) token = match[1];
      }
    }

    if (!token) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const user = await validateSessionToken(token);

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Session fetch error:", error);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
