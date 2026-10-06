import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, validateSessionToken, getCurrentUser } from "@/lib/auth/session";
import { getUsersPresence } from "@/lib/presence/presence";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const currentUser = token ? await validateSessionToken(token) : await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userIdsParam = searchParams.get("userIds");
    const userIds = userIdsParam ? userIdsParam.split(",").filter(Boolean) : [];

    const presenceMap = await getUsersPresence(userIds);

    return NextResponse.json({ presence: presenceMap });
  } catch (error) {
    console.error("GET /api/presence error:", error);
    return NextResponse.json({ error: "Failed to fetch presence" }, { status: 500 });
  }
}
