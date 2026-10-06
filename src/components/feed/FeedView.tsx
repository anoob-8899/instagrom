"use client";

import React, { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { StoriesTray } from "@/components/feed/StoriesTray";
import { PostCard, PostData } from "@/components/feed/PostCard";
import { SuggestedUsers } from "@/components/feed/SuggestedUsers";
import { Loader2, PlusCircle, Sparkles, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface FeedViewProps {
  currentUser: {
    id: string;
    username: string;
    displayName: string;
    profilePhoto?: string | null;
  };
  initialPosts: PostData[];
  initialCursor?: string | null;
}

export const FeedView: React.FC<FeedViewProps> = ({
  currentUser,
  initialPosts,
  initialCursor,
}) => {
  const [posts, setPosts] = useState<PostData[]>(initialPosts);
  const [cursor, setCursor] = useState<string | null>(initialCursor || null);
  const [loadingMore, setLoadingMore] = useState(false);

  // When a new post is created from modal
  const handlePostCreated = (newPost: PostData) => {
    setPosts((prev) => [newPost, ...prev]);
  };

  const handlePostDeleted = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const loadMorePosts = async () => {
    if (!cursor || loadingMore) return;

    setLoadingMore(true);
    try {
      const res = await fetch(`/api/posts?cursor=${cursor}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setPosts((prev) => [...prev, ...(data.posts || [])]);
        setCursor(data.nextCursor);
      }
    } catch (err) {
      console.error("Load more posts error:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <AppShell user={currentUser} onPostCreated={handlePostCreated}>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main Feed Column */}
        <div className="space-y-6 lg:col-span-2 max-w-xl mx-auto w-full">
          {/* Stories Tray */}
          <StoriesTray currentUser={currentUser} />

          {/* Posts List */}
          {posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 mb-4">
                <ImageIcon className="h-7 w-7" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                No posts on the classroom network yet
              </h2>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Be the first student to share a photo! Posts are stored in the host SQLite database and instantly visible across all computers.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUser={currentUser}
                  onPostDeleted={handlePostDeleted}
                />
              ))}

              {/* Load More Button */}
              {cursor && (
                <div className="pt-2 text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadMorePosts}
                    disabled={loadingMore}
                    className="w-full text-xs font-semibold py-2.5"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading more posts...
                      </>
                    ) : (
                      "Load older posts"
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Sidebar Column (Desktop) */}
        <div className="hidden lg:block lg:col-span-1">
          <div className="sticky top-6">
            <SuggestedUsers currentUser={currentUser} />
          </div>
        </div>
      </div>
    </AppShell>
  );
};
