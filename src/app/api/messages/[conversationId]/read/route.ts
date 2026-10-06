import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { isUserConversationParticipant } from "@/lib/messaging/conversations";
import { realtimeHub } from "@/lib/realtime/hub";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { conversationId } = await params;
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isParticipant = await isUserConversationParticipant(conversationId, currentUser.id);
    if (!isParticipant) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();

    const updateResult = await prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: currentUser.id },
        readAt: null,
      },
      data: {
        readAt: now,
      },
    });

    await prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId: currentUser.id,
        },
      },
      data: {
        lastReadAt: now,
      },
    });

    await prisma.notification.updateMany({
      where: {
        recipientId: currentUser.id,
        conversationId,
        readAt: null,
      },
      data: {
        readAt: now,
      },
    });

    const otherParticipants = await prisma.conversationParticipant.findMany({
      where: {
        conversationId,
        userId: { not: currentUser.id },
      },
    });

    for (const p of otherParticipants) {
      realtimeHub.emitToUser(p.userId, "MESSAGE_READ", {
        conversationId,
        readByUserId: currentUser.id,
        readAt: now,
      });
    }

    return NextResponse.json({ success: true, markedCount: updateResult.count });
  } catch (error) {
    console.error("PATCH /api/messages/[conversationId]/read error:", error);
    return NextResponse.json({ error: "Failed to mark messages as read" }, { status: 500 });
  }
}
