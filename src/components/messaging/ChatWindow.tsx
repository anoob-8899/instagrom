"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Check, CheckCheck, Loader2, Send, Wifi, WifiOff } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useRealtime } from "@/lib/realtime/RealtimeProvider";
import { cn } from "@/lib/utils/cn";

export interface MessageItem {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string | Date;
  readAt?: string | Date | null;
  sender: {
    id: string;
    username: string;
    displayName: string;
    profilePhoto?: string | null;
  };
}

interface ChatWindowProps {
  conversationId: string;
  currentUser: {
    id: string;
    username: string;
    displayName: string;
    profilePhoto?: string | null;
  };
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
  onBackClick?: () => void;
  onConversationUpdated?: () => void;
}

function formatMessageTime(dateInput: string | Date): string {
  const date = new Date(dateInput);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  conversationId,
  currentUser,
  otherUser,
  initialPresence,
  onBackClick,
  onConversationUpdated,
}) => {
  const { isConnected, isReconnecting, addCustomEventListener, refreshUnreadCounts } = useRealtime();

  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [presence, setPresence] = useState(initialPresence);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef(true);

  // Check if user is scrolled near bottom
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 120;
  };

  const scrollToBottom = useCallback((smooth = false) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
        block: "end",
      });
    }
  }, []);

  // Mark conversation messages as read
  const markAsRead = useCallback(async () => {
    try {
      await fetch(`/api/conversations/${conversationId}/read`, {
        method: "PATCH",
      });
      refreshUnreadCounts();
      if (onConversationUpdated) {
        onConversationUpdated();
      }
    } catch {
      // Ignore read error
    }
  }, [conversationId, refreshUnreadCounts, onConversationUpdated]);

  // Fetch initial messages
  const fetchMessages = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        if (data.messages && data.messages.length >= 50) {
          setHasMore(true);
        }
      }
    } catch (err) {
      console.error("Error fetching conversation messages:", err);
    } finally {
      setIsLoading(false);
      markAsRead();
      setTimeout(() => scrollToBottom(false), 50);
    }
  }, [conversationId, markAsRead, scrollToBottom]);

  // Load older messages (pagination)
  const handleLoadOlder = async () => {
    if (isLoadingMore || messages.length === 0) return;
    setIsLoadingMore(true);
    try {
      const firstMessage = messages[0];
      const res = await fetch(
        `/api/conversations/${conversationId}/messages?limit=30&cursor=${firstMessage.id}`
      );
      if (res.ok) {
        const data = await res.json();
        const older = data.messages || [];
        if (older.length > 0) {
          setMessages((prev) => [...older, ...prev]);
        }
        if (older.length < 30) {
          setHasMore(false);
        }
      }
    } catch (err) {
      console.error("Error loading older messages:", err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Poll presence for other user
  useEffect(() => {
    if (!otherUser) return;

    const checkPresence = async () => {
      try {
        const res = await fetch(`/api/presence?userIds=${otherUser.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.presence && data.presence[otherUser.id]) {
            setPresence(data.presence[otherUser.id]);
          }
        }
      } catch {
        // Ignore
      }
    };

    checkPresence();
    const interval = setInterval(checkPresence, 15000);
    return () => clearInterval(interval);
  }, [otherUser]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Subscribe to real-time events for this conversation
  useEffect(() => {
    const unsubNewMessage = addCustomEventListener("NEW_MESSAGE", (payload: any) => {
      if (payload.conversationId === conversationId && payload.message) {
        setMessages((prev) => {
          // Avoid duplicates
          if (prev.some((m) => m.id === payload.message.id)) return prev;
          return [...prev, payload.message];
        });

        markAsRead();

        if (isNearBottomRef.current) {
          setTimeout(() => scrollToBottom(true), 50);
        }

        if (onConversationUpdated) {
          onConversationUpdated();
        }
      }
    });

    const unsubMessageRead = addCustomEventListener("MESSAGE_READ", (payload: any) => {
      if (payload.conversationId === conversationId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.senderId === currentUser.id && !msg.readAt
              ? { ...msg, readAt: payload.readAt || new Date() }
              : msg
          )
        );
      }
    });

    return () => {
      unsubNewMessage();
      unsubMessageRead();
    };
  }, [conversationId, currentUser.id, addCustomEventListener, markAsRead, scrollToBottom, onConversationUpdated]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    setSendError(null);

    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Message couldn't be sent. Try again.");
      }

      const data = await res.json();
      setInputText("");
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.message.id)) return prev;
        return [...prev, data.message];
      });

      setTimeout(() => scrollToBottom(true), 50);

      if (onConversationUpdated) {
        onConversationUpdated();
      }
    } catch (err: any) {
      setSendError(err.message || "Message couldn't be sent. Try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex h-full flex-col bg-white dark:bg-slate-950">
      {/* Top Header */}
      <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {onBackClick && (
            <button
              onClick={onBackClick}
              className="mr-1 rounded-lg p-1 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 md:hidden"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}

          <div className="relative shrink-0">
            <Avatar
              src={otherUser?.profilePhoto}
              fallbackName={otherUser?.displayName || "User"}
              size="md"
              className="h-10 w-10"
            />
            {presence?.isOnline && (
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-950" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            {otherUser ? (
              <Link
                href={`/profile/${otherUser.username}`}
                className="block truncate text-sm font-bold text-slate-900 hover:underline dark:text-white"
              >
                {otherUser.displayName}
              </Link>
            ) : (
              <p className="truncate text-sm font-bold text-slate-900 dark:text-white">User</p>
            )}
            <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              {presence?.isOnline ? (
                <span className="font-medium text-emerald-600 dark:text-emerald-400">● Online</span>
              ) : (
                <span>{presence?.statusText || "Offline"}</span>
              )}
            </p>
          </div>
        </div>

        {/* Realtime Status Indicator */}
        <div className="flex items-center gap-2">
          {isReconnecting ? (
            <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              <WifiOff className="h-3.5 w-3.5 animate-pulse" />
              <span>Reconnecting...</span>
            </div>
          ) : isConnected ? (
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
              <Wifi className="h-3 w-3 text-emerald-500" />
              <span className="hidden sm:inline">Realtime Active</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 dark:bg-slate-950/50"
      >
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <>
            {hasMore && (
              <div className="flex justify-center pb-2">
                <button
                  onClick={handleLoadOlder}
                  disabled={isLoadingMore}
                  className="rounded-full bg-slate-200/80 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                >
                  {isLoadingMore ? "Loading older..." : "Load older messages"}
                </button>
              </div>
            )}

            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Avatar
                  src={otherUser?.profilePhoto}
                  fallbackName={otherUser?.displayName || "User"}
                  size="xl"
                  className="h-16 w-16 mb-3"
                />
                <h3 className="font-bold text-slate-900 dark:text-white">
                  {otherUser?.displayName}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">@{otherUser?.username}</p>
                <p className="text-xs text-slate-400 mt-3 max-w-xs">
                  This is the beginning of your direct message history with {otherUser?.displayName}.
                </p>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isMine = msg.senderId === currentUser.id;
                const isRead = !!msg.readAt;

                return (
                  <div
                    key={msg.id || index}
                    className={cn(
                      "flex flex-col max-w-[80%] sm:max-w-[70%]",
                      isMine ? "ml-auto items-end" : "mr-auto items-start"
                    )}
                  >
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-2.5 text-sm shadow-xs break-words",
                        isMine
                          ? "bg-blue-600 text-white rounded-br-xs"
                          : "bg-white text-slate-900 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-white rounded-bl-xs"
                      )}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>

                    <div
                      className={cn(
                        "flex items-center gap-1 mt-1 text-[10px] text-slate-400 px-1",
                        isMine ? "justify-end" : "justify-start"
                      )}
                    >
                      <span>{formatMessageTime(msg.createdAt)}</span>
                      {isMine && (
                        <span>
                          {isRead ? (
                            <span title="Read">
                              <CheckCheck className="h-3 w-3 text-blue-500 inline" />
                            </span>
                          ) : (
                            <span title="Sent">
                              <Check className="h-3 w-3 text-slate-400 inline" />
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Error alert */}
      {sendError && (
        <div className="bg-rose-50 border-t border-rose-200 px-4 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-400 flex items-center justify-between">
          <span>{sendError}</span>
          <button
            onClick={() => setSendError(null)}
            className="font-bold underline ml-2 hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Composer Input Area */}
      <form
        onSubmit={handleSendMessage}
        className="border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950 shrink-0"
      >
        <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a message..."
            rows={1}
            maxLength={2000}
            className="flex-1 resize-none bg-transparent px-2 py-1 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white max-h-32 min-h-[36px]"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            title="Send Message"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white transition-all hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 shrink-0"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        {inputText.length > 1800 && (
          <p className="text-[10px] text-right text-slate-400 mt-1 px-1">
            {2000 - inputText.length} characters left
          </p>
        )}
      </form>
    </div>
  );
};
