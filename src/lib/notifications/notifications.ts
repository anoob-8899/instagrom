import { prisma } from "@/lib/db/prisma";
import { realtimeHub } from "@/lib/realtime/hub";

export type NotificationType = "LIKE" | "COMMENT" | "FOLLOW" | "MESSAGE";

export interface CreateNotificationParams {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  postId?: string | null;
  commentId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
}

/**
 * Creates a persistent notification in SQLite and dispatches a real-time event to the recipient.
 * If the actor is the recipient (e.g. liking own post), no notification is created.
 */
export async function createNotification(params: CreateNotificationParams) {
  const { recipientId, actorId, type, postId, commentId, conversationId, messageId } = params;

  // Don't notify oneself
  if (recipientId === actorId) {
    return null;
  }

  // Avoid duplicate unread follow/like notifications if one already exists recently
  if (type === "LIKE" && postId) {
    const existingLikeNotif = await prisma.notification.findFirst({
      where: {
        recipientId,
        actorId,
        type: "LIKE",
        postId,
        readAt: null,
      },
    });
    if (existingLikeNotif) {
      return existingLikeNotif;
    }
  }

  if (type === "FOLLOW") {
    const existingFollowNotif = await prisma.notification.findFirst({
      where: {
        recipientId,
        actorId,
        type: "FOLLOW",
        readAt: null,
      },
    });
    if (existingFollowNotif) {
      return existingFollowNotif;
    }
  }

  try {
    const notification = await prisma.notification.create({
      data: {
        recipientId,
        actorId,
        type,
        postId: postId || null,
        commentId: commentId || null,
        conversationId: conversationId || null,
        messageId: messageId || null,
      },
      include: {
        actor: {
          select: {
            id: true,
            username: true,
            displayName: true,
            profilePhoto: true,
          },
        },
        post: {
          select: {
            id: true,
            imageUrl: true,
            caption: true,
          },
        },
      },
    });

    // Real-time dispatch to recipient
    realtimeHub.emitToUser(recipientId, "NEW_NOTIFICATION", {
      notification,
    });

    return notification;
  } catch (error) {
    console.error("Failed to create notification:", error);
    return null;
  }
}
