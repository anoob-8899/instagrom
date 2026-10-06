import { prisma } from "@/lib/db/prisma";
import { getUsersPresence } from "@/lib/presence/presence";

/**
 * Finds or creates a 1-to-1 conversation between two users without creating duplicates.
 */
export async function getOrCreateConversation(userAId: string, userBId: string) {
  if (userAId === userBId) {
    throw new Error("Cannot create conversation with yourself");
  }

  // Find existing conversation containing both participants
  const existing = await prisma.conversation.findFirst({
    where: {
      AND: [
        { participants: { some: { userId: userAId } } },
        { participants: { some: { userId: userBId } } },
      ],
    },
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

  if (existing) {
    return existing;
  }

  // Create new conversation with both participants
  const newConversation = await prisma.conversation.create({
    data: {
      participants: {
        create: [
          { userId: userAId },
          { userId: userBId },
        ],
      },
    },
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

  return newConversation;
}

/**
 * Lists all conversations for a user with the latest message and unread counts.
 */
export async function getUserConversations(userId: string) {
  const conversations = await prisma.conversation.findMany({
    where: {
      participants: {
        some: { userId },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
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
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              displayName: true,
            },
          },
        },
      },
    },
  });

  // Calculate unread counts and presence for each conversation
  const otherUserIds: string[] = [];
  conversations.forEach((conv) => {
    const other = conv.participants.find((p) => p.userId !== userId)?.user;
    if (other && !otherUserIds.includes(other.id)) {
      otherUserIds.push(other.id);
    }
  });

  const presenceMap = await getUsersPresence(otherUserIds);

  const enrichedConversations = await Promise.all(
    conversations.map(async (conv) => {
      const otherParticipant = conv.participants.find((p) => p.userId !== userId)?.user || null;
      const lastMessage = conv.messages[0] || null;

      const unreadCount = await prisma.message.count({
        where: {
          conversationId: conv.id,
          senderId: { not: userId },
          readAt: null,
        },
      });

      const presence = otherParticipant ? presenceMap[otherParticipant.id] || { isOnline: false, statusText: "Offline", lastSeenAt: null } : null;

      return {
        id: conv.id,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        otherUser: otherParticipant,
        presence,
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content,
              senderId: lastMessage.senderId,
              createdAt: lastMessage.createdAt,
              readAt: lastMessage.readAt,
            }
          : null,
        unreadCount,
      };
    })
  );

  // Sort by latest message time or conversation update time
  return enrichedConversations.sort((a, b) => {
    const timeA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : new Date(a.updatedAt).getTime();
    const timeB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : new Date(b.updatedAt).getTime();
    return timeB - timeA;
  });
}

/**
 * Validates whether a user is a participant in a conversation.
 */
export async function isUserConversationParticipant(conversationId: string, userId: string): Promise<boolean> {
  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId,
      },
    },
  });
  return !!participant;
}
