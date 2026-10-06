import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, validateSessionToken, getCurrentUser } from "@/lib/auth/session";
import { recordPresenceHeartbeat } from "@/lib/presence/presence";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const currentUser = token ? await validateSessionToken(token) : await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await recordPresenceHeartbeat(currentUser.id);

    return NextResponse.json({ success: true, timestamp: Date.now() });
  } catch (error) {
    console.error("Presence heartbeat error:", error);
    return NextResponse.json({ error: "Failed to record heartbeat" }, { status: 500 });
  }
}
