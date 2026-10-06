import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getUserConversations, isUserConversationParticipant } from "@/lib/messaging/conversations";
import { getUsersPresence } from "@/lib/presence/presence";
import { ConversationClientPage } from "./ConversationClientPage";

export const dynamic = "force-dynamic";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/login");
  }

  // Security check: Must be a participant
  const isParticipant = await isUserConversationParticipant(conversationId, currentUser.id);
  if (!isParticipant) {
    redirect("/messages");
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
    notFound();
  }

  const otherParticipant =
    conversation.participants.find((p) => p.userId !== currentUser.id)?.user || null;

  let initialPresence = null;
  if (otherParticipant) {
    const presenceMap = await getUsersPresence([otherParticipant.id]);
    initialPresence = presenceMap[otherParticipant.id] || null;
  }

  const allConversations = await getUserConversations(currentUser.id);

  const serializedConversations = JSON.parse(JSON.stringify(allConversations));
  const serializedOtherUser = JSON.parse(JSON.stringify(otherParticipant));
  const serializedPresence = JSON.parse(JSON.stringify(initialPresence));

  return (
    <ConversationClientPage
      currentUser={currentUser}
      conversationId={conversationId}
      otherUser={serializedOtherUser}
      initialPresence={serializedPresence}
      initialConversations={serializedConversations}
    />
  );
}
