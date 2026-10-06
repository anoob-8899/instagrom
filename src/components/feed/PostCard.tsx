"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import {
  Bookmark,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Send,
  Trash2,
  Check,
  Loader2,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils/cn";

export interface CommentItem {
  id: string;
  content: string;
  createdAt: string | Date;
  author: {
    id: string;
    username: string;
    displayName: string;
    profilePhoto?: string | null;
  };
}

export interface PostData {
  id: string;
  caption?: string | null;
  imageUrl: string;
  createdAt: string | Date;
  updatedAt?: string | Date;
  author: {
    id: string;
    username: string;
    displayName: string;
    profilePhoto?: string | null;
  };
  likeCount: number;
  commentCount: number;
  isLiked?: boolean;
  isSaved?: boolean;
  recentComments?: CommentItem[];
}

interface PostCardProps {
  post: PostData;
  currentUser?: {
    id: string;
    username: string;
    displayName: string;
    profilePhoto?: string | null;
  } | null;
  onPostDeleted?: (postId: string) => void;
  onPostUpdated?: (post: PostData) => void;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  currentUser,
  onPostDeleted,
  onPostUpdated,
}) => {
  // State
  const [liked, setLiked] = useState(post.isLiked || false);
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);
  const [saved, setSaved] = useState(post.isSaved || false);
  const [comments, setComments] = useState<CommentItem[]>(post.recentComments || []);
  const [commentCount, setCommentCount] = useState(post.commentCount || 0);
  const [showAllComments, setShowAllComments] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);

  // New comment input
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  // Heart animation overlay for double click
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isDeletingPost, setIsDeletingPost] = useState(false);

  const commentInputRef = useRef<HTMLInputElement>(null);

  // Format relative timestamp
  const formatTimeAgo = (dateInput: string | Date) => {
    const date = new Date(dateInput);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSeconds < 60) return "just now";
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  // Toggle Like with optimistic UI
  const handleLikeToggle = async () => {
    const nextLiked = !liked;
    const nextCount = nextLiked ? likeCount + 1 : Math.max(0, likeCount - 1);

    setLiked(nextLiked);
    setLikeCount(nextCount);

    try {
      const res = await fetch(`/api/posts/${post.id}/like`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setLiked(data.liked);
        setLikeCount(data.likeCount);
      } else {
        // Rollback
        setLiked(liked);
        setLikeCount(likeCount);
      }
    } catch {
      // Rollback
      setLiked(liked);
      setLikeCount(likeCount);
    }
  };

  // Double click on image to like
  const handleImageDoubleClick = () => {
    setShowHeartBurst(true);
    setTimeout(() => setShowHeartBurst(false), 900);
    if (!liked) {
      handleLikeToggle();
    }
  };

  // Toggle Save
  const handleSaveToggle = async () => {
    const nextSaved = !saved;
    setSaved(nextSaved);

    try {
      const res = await fetch(`/api/posts/${post.id}/save`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setSaved(data.saved);
      } else {
        setSaved(saved);
      }
    } catch {
      setSaved(saved);
    }
  };

  // Share post (copy link)
  const handleShare = () => {
    const postUrl = `${window.location.origin}/post/${post.id}`;
    navigator.clipboard.writeText(postUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Load all comments
  const handleLoadAllComments = async () => {
    if (showAllComments) {
      setShowAllComments(false);
      return;
    }

    setLoadingComments(true);
    try {
      const res = await fetch(`/api/posts/${post.id}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
        setShowAllComments(true);
      }
    } catch (err) {
      console.error("Load comments error:", err);
    } finally {
      setLoadingComments(false);
    }
  };

  // Submit comment
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || submittingComment) return;

    const content = commentText.trim();
    setCommentText("");
    setSubmittingComment(true);

    try {
      const res = await fetch(`/api/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (res.ok) {
        const data = await res.json();
        setComments((prev) => [...prev, data.comment]);
        setCommentCount(data.commentCount);
      }
    } catch (err) {
      console.error("Add comment error:", err);
    } finally {
      setSubmittingComment(false);
    }
  };

  // Delete comment
  const handleDeleteComment = async (commentId: string) => {
    setDeletingCommentId(commentId);
    try {
      const res = await fetch(`/api/posts/${post.id}/comments/${commentId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        const data = await res.json();
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        setCommentCount(data.commentCount);
      }
    } catch (err) {
      console.error("Delete comment error:", err);
    } finally {
      setDeletingCommentId(null);
    }
  };

  // Delete post
  const handleDeletePost = async () => {
    if (!confirm("Are you sure you want to delete this post?")) return;

    setIsDeletingPost(true);
    try {
      const res = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
      if (res.ok && onPostDeleted) {
        onPostDeleted(post.id);
      }
    } catch (err) {
      console.error("Delete post error:", err);
    } finally {
      setIsDeletingPost(false);
      setShowMenu(false);
    }
  };

  const isAuthor = currentUser?.id === post.author.id;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-all">
      {/* 1. Header */}
      <div className="flex items-center justify-between p-3.5 sm:px-4">
        <div className="flex items-center gap-3">
          <Link href={`/profile/${post.author.username}`}>
            <Avatar
              src={post.author.profilePhoto}
              fallbackName={post.author.displayName}
              size="sm"
            />
          </Link>
          <div>
            <Link
              href={`/profile/${post.author.username}`}
              className="font-bold text-xs sm:text-sm text-slate-900 hover:underline dark:text-white"
            >
              {post.author.displayName}
            </Link>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <Link href={`/profile/${post.author.username}`} className="hover:underline">
                @{post.author.username}
              </Link>
              <span>&bull;</span>
              <span>{formatTimeAgo(post.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* More Options dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-8 z-20 w-44 rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95">
              <button
                onClick={() => {
                  handleShare();
                  setShowMenu(false);
                }}
                className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Send className="h-3.5 w-3.5" />
                Copy Post Link
              </button>

              {isAuthor && (
                <button
                  onClick={handleDeletePost}
                  disabled={isDeletingPost}
                  className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {isDeletingPost ? "Deleting..." : "Delete Post"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Image with double click heart animation */}
      <div
        className="relative aspect-square w-full select-none overflow-hidden bg-slate-950 flex items-center justify-center cursor-pointer"
        onDoubleClick={handleImageDoubleClick}
      >
        <img
          src={post.imageUrl}
          alt={post.caption || "Post image"}
          className="h-full w-full object-cover"
        />

        {/* Animated Heart Overlay on double click */}
        {showHeartBurst && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-in zoom-in-50 fade-in duration-200">
            <Heart className="h-24 w-24 fill-white text-white drop-shadow-2xl animate-pulse" />
          </div>
        )}
      </div>

      {/* 3. Action Buttons */}
      <div className="p-3.5 sm:px-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Like */}
            <button
              onClick={handleLikeToggle}
              className="group focus:outline-none transition-transform active:scale-125"
              aria-label="Like post"
            >
              <Heart
                className={cn(
                  "h-6 w-6 transition-colors",
                  liked
                    ? "fill-rose-600 text-rose-600"
                    : "text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                )}
              />
            </button>

            {/* Comment */}
            <button
              onClick={() => commentInputRef.current?.focus()}
              className="group focus:outline-none transition-transform active:scale-95"
              aria-label="Comment on post"
            >
              <MessageCircle className="h-6 w-6 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors" />
            </button>

            {/* Share / Copy */}
            <button
              onClick={handleShare}
              className="group focus:outline-none transition-transform active:scale-95 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white relative"
              aria-label="Share post"
              title="Copy link to clipboard"
            >
              {copiedLink ? (
                <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Send className="h-6 w-6 transition-colors" />
              )}
            </button>
          </div>

          {/* Save / Bookmark */}
          <button
            onClick={handleSaveToggle}
            className="group focus:outline-none transition-transform active:scale-110"
            aria-label="Save post"
          >
            <Bookmark
              className={cn(
                "h-6 w-6 transition-colors",
                saved
                  ? "fill-slate-900 text-slate-900 dark:fill-white dark:text-white"
                  : "text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              )}
            />
          </button>
        </div>

        {copiedLink && (
          <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            Link copied to clipboard!
          </p>
        )}

        {/* 4. Like Count */}
        <div className="text-xs font-bold text-slate-900 dark:text-white">
          {likeCount === 0
            ? "Be the first to like this"
            : `${likeCount.toLocaleString()} ${likeCount === 1 ? "like" : "likes"}`}
        </div>

        {/* 5. Caption */}
        {post.caption && (
          <div className="text-xs leading-relaxed text-slate-800 dark:text-slate-200">
            <Link
              href={`/profile/${post.author.username}`}
              className="mr-1.5 font-bold text-slate-900 hover:underline dark:text-white"
            >
              {post.author.username}
            </Link>
            <span className="whitespace-pre-wrap">{post.caption}</span>
          </div>
        )}

        {/* 6. Comments section */}
        {commentCount > 0 && (
          <div className="space-y-1 pt-1">
            {commentCount > (comments.length || 0) && (
              <button
                onClick={handleLoadAllComments}
                disabled={loadingComments}
                className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                {loadingComments
                  ? "Loading comments..."
                  : `View all ${commentCount} comments`}
              </button>
            )}

            {/* List of comments */}
            <div className="space-y-1.5 pt-1">
              {comments.map((comment) => {
                const canDelete =
                  currentUser?.id === comment.author.id ||
                  currentUser?.id === post.author.id;

                return (
                  <div
                    key={comment.id}
                    className="group flex items-start justify-between text-xs text-slate-800 dark:text-slate-200"
                  >
                    <div className="leading-snug pr-2">
                      <Link
                        href={`/profile/${comment.author.username}`}
                        className="mr-1.5 font-bold text-slate-900 hover:underline dark:text-white"
                      >
                        {comment.author.username}
                      </Link>
                      <span>{comment.content}</span>
                    </div>

                    {canDelete && (
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        disabled={deletingCommentId === comment.id}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                        title="Delete comment"
                      >
                        {deletingCommentId === comment.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 7. Comment Input Box */}
        <form
          onSubmit={handleCommentSubmit}
          className="flex items-center gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800"
        >
          <input
            ref={commentInputRef}
            type="text"
            placeholder="Add a comment..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            className="flex-1 bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white dark:placeholder:text-slate-500"
          />
          {commentText.trim() && (
            <button
              type="submit"
              disabled={submittingComment}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 disabled:opacity-50"
            >
              {submittingComment ? "Posting..." : "Post"}
            </button>
          )}
        </form>
      </div>
    </article>
  );
};
