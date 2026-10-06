import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { realtimeHub } from "@/lib/realtime/hub";
import { recordPresenceHeartbeat } from "@/lib/presence/presence";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Update presence on connection
  recordPresenceHeartbeat(currentUser.id).catch(() => {});

  let unsubscribe: (() => void) | null = null;
  let pingInterval: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial handshake
      const initData = `data: ${JSON.stringify({
        type: "CONNECTED",
        payload: { userId: currentUser.id, serverTime: Date.now() },
      })}\n\n`;
      controller.enqueue(encoder.encode(initData));

      // Subscribe to real-time events for this user
      unsubscribe = realtimeHub.subscribe(currentUser.id, (event) => {
        try {
          const chunk = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Stream closed or error
        }
      });

      // Keep connection alive with periodic heartbeat ping every 25s
      pingInterval = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "PING", timestamp: Date.now() })}\n\n`)
          );
        } catch {
          if (pingInterval) clearInterval(pingInterval);
        }
      }, 25000);
    },
    cancel() {
      if (unsubscribe) {
        unsubscribe();
      }
      if (pingInterval) {
        clearInterval(pingInterval);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
