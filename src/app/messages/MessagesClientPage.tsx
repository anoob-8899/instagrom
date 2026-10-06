"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ConversationList, ConversationItem } from "@/components/messaging/ConversationList";
import { NewConversationModal } from "@/components/messaging/NewConversationModal";
import { MessageSquare, Send } from "lucide-react";
import { useRealtime } from "@/lib/realtime/RealtimeProvider";

interface MessagesClientPageProps {
  currentUser: {
    id: string;
    username: string;
    displayName: string;
    profilePhoto?: string | null;
  };
  initialConversations: ConversationItem[];
}

export const MessagesClientPage: React.FC<MessagesClientPageProps> = ({
  currentUser,
  initialConversations,
}) => {
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
      <div className="h-[calc(100vh-8rem)] min-h-[500px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-950 md:flex">
        {/* Left Side: Conversation List */}
        <div className="h-full w-full md:w-80 lg:w-96 shrink-0">
          <ConversationList
            conversations={conversations}
            onNewChatClick={() => setIsNewModalOpen(true)}
          />
        </div>

        {/* Right Side: Empty selection placeholder on desktop */}
        <div className="hidden flex-1 flex-col items-center justify-center p-8 text-center md:flex bg-slate-50/50 dark:bg-slate-900/30">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            <MessageSquare className="h-10 w-10" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
            Your Direct Messages
          </h2>
          <p className="mt-1 text-sm text-slate-500 max-w-sm">
            Send private messages, photos, and updates to classmates on the INSTAGROM network.
          </p>
          <button
            onClick={() => setIsNewModalOpen(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Send className="h-4 w-4" />
            <span>Send Message</span>
          </button>
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
