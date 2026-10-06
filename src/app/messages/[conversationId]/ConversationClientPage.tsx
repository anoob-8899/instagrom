"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { ConversationList, ConversationItem } from "@/components/messaging/ConversationList";
import { ChatWindow } from "@/components/messaging/ChatWindow";
import { NewConversationModal } from "@/components/messaging/NewConversationModal";
import { useRealtime } from "@/lib/realtime/RealtimeProvider";

interface ConversationClientPageProps {
  currentUser: {
    id: string;
    username: string;
    displayName: string;
    profilePhoto?: string | null;
  };
  conversationId: string;
  otherUser: {
    id: string;
    username: string;
    displayName: string;
    profilePhoto?: string | null;
  } | null;
  initialPresence?: {
    isOnline: boolean;
    statusText: string;
  } | null;
  initialConversations: ConversationItem[];
}

export const ConversationClientPage: React.FC<ConversationClientPageProps> = ({
  currentUser,
  conversationId,
  otherUser,
  initialPresence,
  initialConversations,
}) => {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationItem[]>(initialConversations);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const { addCustomEventListener } = useRealtime();

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    const unsubNewMessage = addCustomEventListener("NEW_MESSAGE", () => {
      fetchConversations();
    });
    const unsubRead = addCustomEventListener("MESSAGE_READ", () => {
      fetchConversations();
    });

    return () => {
      unsubNewMessage();
      unsubRead();
    };
  }, [addCustomEventListener, fetchConversations]);

  return (
    <AppShell user={currentUser}>
      <div className="h-[calc(100vh-8rem)] min-h-[500px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-950 flex">
        {/* Left Side: Conversation List (Desktop only) */}
        <div className="hidden md:block md:w-80 lg:w-96 shrink-0 h-full">
          <ConversationList
            conversations={conversations}
            selectedId={conversationId}
            onNewChatClick={() => setIsNewModalOpen(true)}
          />
        </div>

        {/* Right Side: Active Chat Window */}
        <div className="flex-1 h-full min-w-0">
          <ChatWindow
            conversationId={conversationId}
            currentUser={currentUser}
            otherUser={otherUser}
            initialPresence={initialPresence}
            onBackClick={() => router.push("/messages")}
            onConversationUpdated={fetchConversations}
          />
        </div>
      </div>

      <NewConversationModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        currentUserId={currentUser.id}
      />
    </AppShell>
  );
};
