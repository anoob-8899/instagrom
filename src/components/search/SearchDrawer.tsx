"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Search as SearchIcon, X, Loader2, Image as ImageIcon, Users } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";

interface SearchDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPost?: (postId: string) => void;
}

export const SearchDrawer: React.FC<SearchDrawerProps> = ({
  isOpen,
  onClose,
  onSelectPost,
}) => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "users" | "posts">("all");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
      setUsers([]);
      setPosts([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setUsers([]);
      setPosts([]);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setUsers(data.users || []);
          setPosts(data.posts || []);
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 backdrop-blur-sm sm:p-6 md:p-12">
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <SearchIcon className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            <h3 className="font-bold text-slate-900 dark:text-white">Search InstaGrom</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Input Bar */}
        <div className="p-4">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search by username, display name, caption, #hashtag..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-rose-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-900"
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
            )}
            {query && !loading && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          {(users.length > 0 || posts.length > 0) && (
            <div className="mt-3 flex gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
              <button
                onClick={() => setActiveTab("all")}
                className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                  activeTab === "all"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                All ({users.length + posts.length})
              </button>
              <button
                onClick={() => setActiveTab("users")}
                className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                  activeTab === "users"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                Users ({users.length})
              </button>
              <button
                onClick={() => setActiveTab("posts")}
                className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                  activeTab === "posts"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                Posts ({posts.length})
              </button>
            </div>
          )}
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {!query.trim() ? (
            <div className="py-12 text-center text-slate-400">
              <SearchIcon className="mx-auto h-8 w-8 stroke-1 text-slate-300 dark:text-slate-600" />
              <p className="mt-2 text-xs">Search for peers and posts across the LAN database</p>
            </div>
          ) : users.length === 0 && posts.length === 0 && !loading ? (
            <div className="py-12 text-center text-slate-500">
              <p className="text-sm font-semibold">No results found for &ldquo;{query}&rdquo;</p>
              <p className="mt-1 text-xs text-slate-400">Check spelling or try a different keyword</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Users Results */}
              {(activeTab === "all" || activeTab === "users") && users.length > 0 && (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <Users className="h-3.5 w-3.5" /> Accounts
                  </p>
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/50 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900/40">
                    {users.map((u) => (
                      <Link
                        key={u.id}
                        href={`/profile/${u.username}`}
                        onClick={onClose}
                        className="flex items-center justify-between p-3 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/80"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={u.profilePhoto}
                            fallbackName={u.displayName}
                            size="sm"
                          />
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white">
                              {u.displayName}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              @{u.username}
                            </p>
                          </div>
                        </div>
                        <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
                          View profile &rarr;
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Posts Results */}
              {(activeTab === "all" || activeTab === "posts") && posts.length > 0 && (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <ImageIcon className="h-3.5 w-3.5" /> Posts
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {posts.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          if (onSelectPost) onSelectPost(p.id);
                          onClose();
                        }}
                        className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800"
                      >
                        <img
                          src={p.imageUrl}
                          alt={p.caption || "Post thumbnail"}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-transparent to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                          <p className="line-clamp-1 text-[11px] font-semibold text-white">
                            @{p.author.username}
                          </p>
                          {p.caption && (
                            <p className="line-clamp-1 text-[10px] text-slate-200">
                              {p.caption}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
