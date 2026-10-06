"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Search as SearchIcon, X, Loader2, Users, Image as ImageIcon } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { PostDetailModal } from "@/components/feed/PostDetailModal";

interface SearchPageContentProps {
  currentUser: {
    id: string;
    username: string;
    displayName: string;
    profilePhoto?: string | null;
  };
}

export const SearchPageContent: React.FC<SearchPageContentProps> = ({
  currentUser,
}) => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "users" | "posts">("all");
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

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

  return (
    <AppShell user={currentUser}>
      <div className="max-w-2xl mx-auto space-y-6 py-2">
        <h1 className="text-xl font-black text-slate-900 dark:text-white">
          Explore & Search
        </h1>

        {/* Input Bar */}
        <div className="relative">
          <SearchIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by username, display name, caption, #hashtag..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-10 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          />
          {loading && (
            <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
          )}
          {query && !loading && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        {(users.length > 0 || posts.length > 0) && (
          <div className="flex gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
            <button
              onClick={() => setActiveTab("all")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                activeTab === "all"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              All ({users.length + posts.length})
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                activeTab === "users"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              Accounts ({users.length})
            </button>
            <button
              onClick={() => setActiveTab("posts")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                activeTab === "posts"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              Posts ({posts.length})
            </button>
          </div>
        )}

        {/* Results */}
        {!query.trim() ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
            <SearchIcon className="mx-auto h-10 w-10 stroke-1 text-slate-300 dark:text-slate-600" />
            <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
              Type keywords to search the host database
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Find peers, hashtags (#project), or post captions
            </p>
          </div>
        ) : users.length === 0 && posts.length === 0 && !loading ? (
          <div className="rounded-2xl bg-white p-12 text-center dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800">
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              No matching results found for &ldquo;{query}&rdquo;
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Try searching by partial username, display name, or caption keywords
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Users section */}
            {(activeTab === "all" || activeTab === "users") && users.length > 0 && (
              <div className="space-y-3">
                <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <Users className="h-4 w-4" /> Classroom Accounts
                </h3>
                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                  {users.map((u) => (
                    <Link
                      key={u.id}
                      href={`/profile/${u.username}`}
                      className="flex items-center justify-between p-3.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={u.profilePhoto}
                          fallbackName={u.displayName}
                          size="md"
                        />
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">
                            {u.displayName}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            @{u.username}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                        View profile &rarr;
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Posts section */}
            {(activeTab === "all" || activeTab === "posts") && posts.length > 0 && (
              <div className="space-y-3">
                <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <ImageIcon className="h-4 w-4" /> Matching Posts
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {posts.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPostId(p.id)}
                      className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800"
                    >
                      <img
                        src={p.imageUrl}
                        alt={p.caption || "Post thumbnail"}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-transparent to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
                        <p className="line-clamp-1 text-xs font-bold text-white">
                          @{p.author.username}
                        </p>
                        {p.caption && (
                          <p className="line-clamp-1 text-[11px] text-slate-200">
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

      {selectedPostId && (
        <PostDetailModal
          postId={selectedPostId}
          isOpen={true}
          onClose={() => setSelectedPostId(null)}
          currentUser={currentUser}
        />
      )}
    </AppShell>
  );
};
