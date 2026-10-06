import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Unread notifications count
    const unreadNotifications = await prisma.notification.count({
      where: {
        recipientId: currentUser.id,
        readAt: null,
      },
    });

    // 2. Unread messages count across all user's conversations
    // Find conversation IDs user is part of
    const userParticipants = await prisma.conversationParticipant.findMany({
      where: { userId: currentUser.id },
      select: { conversationId: true },
    });

    const conversationIds = userParticipants.map((p) => p.conversationId);

    const unreadMessages =
      conversationIds.length > 0
        ? await prisma.message.count({
            where: {
              conversationId: { in: conversationIds },
              senderId: { not: currentUser.id },
              readAt: null,
            },
          })
        : 0;

    return NextResponse.json({
      unreadNotifications,
      unreadMessages,
    });
  } catch (error) {
    console.error("GET /api/notifications/unread-count error:", error);
    return NextResponse.json(
      { error: "Failed to fetch unread counts" },
      { status: 500 }
    );
  }
}
