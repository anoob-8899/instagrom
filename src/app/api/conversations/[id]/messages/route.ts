import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { isUserConversationParticipant } from "@/lib/messaging/conversations";
import { createNotification } from "@/lib/notifications/notifications";
import { realtimeHub } from "@/lib/realtime/hub";

export const dynamic = "force-dynamic";

export async function GET(
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
      return NextResponse.json({ error: "Forbidden: Not a participant in this conversation" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const cursor = searchParams.get("cursor"); // messageId for pagination

    let messages;
    if (cursor) {
      const cursorMessage = await prisma.message.findUnique({
        where: { id: cursor },
        select: { createdAt: true },
      });

      if (!cursorMessage) {
        return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
      }

      messages = await prisma.message.findMany({
        where: {
          conversationId,
          createdAt: { lt: cursorMessage.createdAt },
        },
        orderBy: { createdAt: "asc" },
        take: limit,
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
    } else {
      // Latest N messages ordered asc for chat rendering
      const rawMessages = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "desc" },
        take: limit,
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
      messages = rawMessages.reverse();
    }

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("GET /api/conversations/[id]/messages error:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

export async function POST(
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
      return NextResponse.json({ error: "Forbidden: Cannot send messages to this conversation" }, { status: 403 });
    }

    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { error: "Message content cannot be empty" },
        { status: 400 }
      );
    }

    if (content.trim().length > 2000) {
      return NextResponse.json(
        { error: "Message cannot exceed 2,000 characters" },
        { status: 400 }
      );
    }

    const trimmedContent = content.trim();

    // 1. Create message in SQLite
    const newMessage = await prisma.message.create({
      data: {
        conversationId,
        senderId: currentUser.id,
        content: trimmedContent,
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

    // 2. Update conversation timestamp
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // 3. Find recipient(s) in conversation
    const participants = await prisma.conversationParticipant.findMany({
      where: {
        conversationId,
        userId: { not: currentUser.id },
      },
    });

    // 4. Notify each recipient via Notification + Realtime
    for (const participant of participants) {
      // Create notification
      await createNotification({
        recipientId: participant.userId,
        actorId: currentUser.id,
        type: "MESSAGE",
        conversationId,
        messageId: newMessage.id,
      });

      // Dispatch NEW_MESSAGE event
      realtimeHub.emitToUser(participant.userId, "NEW_MESSAGE", {
        conversationId,
        message: newMessage,
      });
    }

    return NextResponse.json(
      { message: newMessage },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/conversations/[id]/messages error:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
