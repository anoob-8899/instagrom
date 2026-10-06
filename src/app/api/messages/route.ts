import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserConversations, getOrCreateConversation, isUserConversationParticipant } from "@/lib/messaging/conversations";
import { prisma } from "@/lib/db/prisma";
import { createNotification } from "@/lib/notifications/notifications";
import { realtimeHub } from "@/lib/realtime/hub";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const conversations = await getUserConversations(currentUser.id);
    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("GET /api/messages error:", error);
    return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { conversationId, recipientUsername, recipientId, content } = body;

    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "Message content cannot be empty" }, { status: 400 });
    }

    if (content.trim().length > 2000) {
      return NextResponse.json({ error: "Message cannot exceed 2000 characters" }, { status: 400 });
    }

    let targetConvId = conversationId;

    // If conversationId wasn't passed directly, resolve or create via recipient
    if (!targetConvId) {
      let targetUserId = recipientId;
      if (!targetUserId && recipientUsername) {
        const u = await prisma.user.findUnique({
          where: { username: recipientUsername.toLowerCase().trim() },
          select: { id: true },
        });
        if (!u) {
          return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
        }
        targetUserId = u.id;
      }

      if (!targetUserId) {
        return NextResponse.json({ error: "conversationId or recipient is required" }, { status: 400 });
      }

      const conv = await getOrCreateConversation(currentUser.id, targetUserId);
      targetConvId = conv.id;
    }

    // Security check: must be a participant
    const isParticipant = await isUserConversationParticipant(targetConvId, currentUser.id);
    if (!isParticipant) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const newMessage = await prisma.message.create({
      data: {
        conversationId: targetConvId,
        senderId: currentUser.id,
        content: content.trim(),
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            profilePhoto: true,
          },
        },
      },
    });

    await prisma.conversation.update({
      where: { id: targetConvId },
      data: { updatedAt: new Date() },
    });

    const participants = await prisma.conversationParticipant.findMany({
      where: {
        conversationId: targetConvId,
        userId: { not: currentUser.id },
      },
    });

    for (const participant of participants) {
      await createNotification({
        recipientId: participant.userId,
        actorId: currentUser.id,
        type: "MESSAGE",
        conversationId: targetConvId,
        messageId: newMessage.id,
      });

      realtimeHub.emitToUser(participant.userId, "NEW_MESSAGE", {
        conversationId: targetConvId,
        message: newMessage,
      });
    }

    return NextResponse.json({ message: newMessage, conversationId: targetConvId }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/messages error:", error);
    return NextResponse.json({ error: error.message || "Failed to send message" }, { status: 500 });
  }
}
