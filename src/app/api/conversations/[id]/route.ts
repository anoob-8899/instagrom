import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { isUserConversationParticipant } from "@/lib/messaging/conversations";
import { getUsersPresence } from "@/lib/presence/presence";

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

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                profilePhoto: true,
              },
            },
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const otherParticipant = conversation.participants.find((p) => p.userId !== currentUser.id)?.user || null;
    let presence = null;
    if (otherParticipant) {
      const presenceMap = await getUsersPresence([otherParticipant.id]);
      presence = presenceMap[otherParticipant.id] || null;
    }

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        otherUser: otherParticipant,
        presence,
        participants: conversation.participants.map((p) => p.user),
      },
    });
  } catch (error) {
    console.error("GET /api/conversations/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversation" },
      { status: 500 }
    );
  }
}
