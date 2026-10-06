"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquare, Search, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";

interface UserSearchResult {
  id: string;
  username: string;
  displayName: string;
  profilePhoto?: string | null;
}

interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
}

export const NewConversationModal: React.FC<NewConversationModalProps> = ({
  isOpen,
  onClose,
  currentUserId,
}) => {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setUsers([]);
      return;
    }

    const fetchUsers = async () => {
      setIsLoading(true);
      try {
        const endpoint = query.trim()
          ? `/api/search?q=${encodeURIComponent(query)}`
          : `/api/users/suggested`;
        const res = await fetch(endpoint);
        if (res.ok) {
          const data = await res.json();
          const list = data.users || [];
          setUsers(list.filter((u: UserSearchResult) => u.id !== currentUserId));
        }
      } catch {
        // Ignore
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(fetchUsers, query.trim() ? 300 : 0);
    return () => clearTimeout(timer);
  }, [isOpen, query, currentUserId]);

  const handleSelectUser = async (user: UserSearchResult) => {
    setIsCreating(true);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: user.id }),
      });

      if (res.ok) {
        const data = await res.json();
        onClose();
        router.push(`/messages/${data.conversation.id}`);
      }
    } catch {
      // Ignore
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">New Message</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="relative mt-4">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search students..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            autoFocus
          />
        </div>

        {/* User list */}
        <div className="mt-3 max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : users.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">No users found</p>
          ) : (
            users.map((user) => (
              <button
                key={user.id}
                onClick={() => handleSelectUser(user)}
                disabled={isCreating}
                className="flex w-full items-center gap-3 py-2.5 px-2 text-left hover:bg-slate-50 rounded-xl dark:hover:bg-slate-800/60 transition-colors"
              >
                <Avatar
                  src={user.profilePhoto}
                  fallbackName={user.displayName}
                  size="sm"
                  className="h-9 w-9"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                    {user.displayName}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    @{user.username}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
