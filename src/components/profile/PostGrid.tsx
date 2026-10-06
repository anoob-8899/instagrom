"use client";

import React, { useState } from "react";
import { Heart, MessageCircle, Grid, Bookmark, Image as ImageIcon } from "lucide-react";
import { PostDetailModal } from "@/components/feed/PostDetailModal";

interface PostGridProps {
  posts: Array<{
    id: string;
    imageUrl: string;
    caption?: string | null;
    createdAt: string | Date;
    likeCount: number;
    commentCount: number;
  }>;
  savedPosts?: Array<{
    id: string;
    imageUrl: string;
    caption?: string | null;
    createdAt: string | Date;
    likeCount: number;
    commentCount: number;
  }>;
  isSelf: boolean;
  currentUser?: {
    id: string;
    username: string;
    displayName: string;
    profilePhoto?: string | null;
  } | null;
  onPostDeleted?: (postId: string) => void;
}

export const PostGrid: React.FC<PostGridProps> = ({
  posts,
  savedPosts = [],
  isSelf,
  currentUser,
  onPostDeleted,
}) => {
  const [activeTab, setActiveTab] = useState<"posts" | "saved">("posts");
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const displayList = activeTab === "posts" ? posts : savedPosts;

  return (
    <div className="space-y-6">
      {/* Tabs (Posts / Saved) */}
      <div className="flex justify-center border-t border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab("posts")}
          className={`flex items-center gap-2 border-t-2 px-6 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
            activeTab === "posts"
              ? "border-slate-900 text-slate-900 dark:border-white dark:text-white"
              : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          }`}
        >
          <Grid className="h-4 w-4" />
          <span>Posts ({posts.length})</span>
        </button>

        {isSelf && (
          <button
            onClick={() => setActiveTab("saved")}
            className={`flex items-center gap-2 border-t-2 px-6 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
              activeTab === "saved"
                ? "border-slate-900 text-slate-900 dark:border-white dark:text-white"
                : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            }`}
          >
            <Bookmark className="h-4 w-4" />
            <span>Saved ({savedPosts.length})</span>
          </button>
        )}
      </div>

      {/* Grid */}
      {displayList.length === 0 ? (
        <div className="py-16 text-center text-slate-400">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-slate-200 dark:border-slate-800 mb-3">
            <ImageIcon className="h-7 w-7 stroke-1" />
          </div>
          <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm">
            {activeTab === "posts" ? "No posts yet" : "No saved posts"}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {activeTab === "posts"
              ? "When photos are shared, they will appear here."
              : "Saved posts are private to your account."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1 sm:gap-4 md:gap-6">
          {displayList.map((post) => (
            <div
              key={post.id}
              onClick={() => setSelectedPostId(post.id)}
              className="group relative aspect-square cursor-pointer overflow-hidden rounded-md sm:rounded-xl bg-slate-100 dark:bg-slate-800"
            >
              <img
                src={post.imageUrl}
                alt={post.caption || "User post"}
                className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
              />

              {/* Hover overlay with like and comment counts */}
              <div className="absolute inset-0 flex items-center justify-center gap-4 sm:gap-6 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-1.5 text-white font-bold text-xs sm:text-sm">
                  <Heart className="h-4 w-4 fill-white" />
                  <span>{post.likeCount}</span>
                </div>
                <div className="flex items-center gap-1.5 text-white font-bold text-xs sm:text-sm">
                  <MessageCircle className="h-4 w-4 fill-white" />
                  <span>{post.commentCount}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Post Detail Modal */}
      {selectedPostId && (
        <PostDetailModal
          postId={selectedPostId}
          isOpen={true}
          onClose={() => setSelectedPostId(null)}
          currentUser={currentUser}
          onPostDeleted={(id) => {
            setSelectedPostId(null);
            if (onPostDeleted) onPostDeleted(id);
          }}
        />
      )}
    </div>
  );
};
