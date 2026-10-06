"use client";

import React from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { MessageSquare, Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface ConversationItem {
  id: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  otherUser: {
    id: string;
    username: string;
    displayName: string;
    profilePhoto?: string | null;
  } | null;
  presence?: {
    isOnline: boolean;
    statusText: string;
    lastSeenAt: string | Date | null;
  } | null;
  lastMessage?: {
    id: string;
    content: string;
    senderId: string;
    createdAt: string | Date;
    readAt?: string | Date | null;
  } | null;
  unreadCount: number;
}

interface ConversationListProps {
  conversations: ConversationItem[];
  selectedId?: string;
  onNewChatClick?: () => void;
}

function formatRelativeTime(dateInput?: string | Date | null): string {
  if (!dateInput) return "";
  const date = new Date(dateInput);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  selectedId,
  onNewChatClick,
}) => {
  return (
    <div className="flex h-full flex-col bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5 dark:border-slate-800">
        <div>
          <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
            Messages
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {conversations.length} {conversations.length === 1 ? "conversation" : "conversations"}
          </p>
        </div>

        {onNewChatClick && (
          <button
            onClick={onNewChatClick}
            title="New Message"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-900">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-900">
              <MessageSquare className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
              No messages yet
            </p>
            <p className="mt-1 text-xs text-slate-500 max-w-[200px]">
              Start a conversation by visiting someone&apos;s profile or clicking the plus button.
            </p>
            {onNewChatClick && (
              <button
                onClick={onNewChatClick}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Send a message</span>
              </button>
            )}
          </div>
        ) : (
          conversations.map((conv) => {
            const isSelected = selectedId === conv.id;
            const other = conv.otherUser;
            const hasUnread = conv.unreadCount > 0;
            const isOnline = conv.presence?.isOnline || false;

            return (
              <Link
                key={conv.id}
                href={`/messages/${conv.id}`}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/60 relative",
                  isSelected && "bg-slate-100/90 dark:bg-slate-900"
                )}
              >
                {/* Avatar with presence dot */}
                <div className="relative shrink-0">
                  <Avatar
                    src={other?.profilePhoto}
                    fallbackName={other?.displayName || "User"}
                    size="md"
                    className="h-11 w-11"
                  />
                  {isOnline && (
                    <span
                      title="Online"
                      className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-950"
                    />
                  )}
                </div>

                {/* Conversation info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p
                      className={cn(
                        "truncate text-sm font-semibold text-slate-900 dark:text-white",
                        hasUnread && "font-bold text-slate-950 dark:text-white"
                      )}
                    >
                      {other?.displayName || "User"}
                    </p>
                    <span className="shrink-0 text-[11px] text-slate-400">
                      {formatRelativeTime(conv.lastMessage?.createdAt || conv.updatedAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p
                      className={cn(
                        "truncate text-xs text-slate-500 dark:text-slate-400",
                        hasUnread && "font-semibold text-slate-900 dark:text-slate-100"
                      )}
                    >
                      {conv.lastMessage?.content || "Started a conversation"}
                    </p>

                    {hasUnread && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white shrink-0">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
};
