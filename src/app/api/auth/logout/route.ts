import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, destroySession, clearAuthCookie } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  try {
    let token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!token) {
      const cookieHeader = req.headers.get("cookie");
      if (cookieHeader) {
        const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
        if (match) token = match[1];
      }
    }

    if (token) {
      await destroySession(token);
    }

    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully.",
    });

    clearAuthCookie(response);
    return response;
  } catch (error) {
    console.error("Logout error:", error);
    const response = NextResponse.json(
      { error: "An error occurred during logout." },
      { status: 500 }
    );
    clearAuthCookie(response);
    return response;
  }
}
