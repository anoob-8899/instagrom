import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { isUserConversationParticipant } from "@/lib/messaging/conversations";
import { realtimeHub } from "@/lib/realtime/hub";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Security check: must be a participant
    const isParticipant = await isUserConversationParticipant(conversationId, currentUser.id);
    if (!isParticipant) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();

    // 1. Mark unread messages sent by others in this conversation as read
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

    // 2. Update participant's lastReadAt
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

    // 3. Mark message notifications for this conversation as read for currentUser
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

    // 4. Notify other participants that messages were read
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

    return NextResponse.json({
      success: true,
      markedCount: updateResult.count,
    });
  } catch (error) {
    console.error("PATCH /api/conversations/[id]/read error:", error);
    return NextResponse.json(
      { error: "Failed to mark messages as read" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return PATCH(request, context);
}
