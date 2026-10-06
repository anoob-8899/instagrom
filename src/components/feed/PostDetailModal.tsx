"use client";

import React, { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { PostCard, PostData } from "./PostCard";

interface PostDetailModalProps {
  postId: string | null;
  isOpen: boolean;
  onClose: () => void;
  currentUser?: {
    id: string;
    username: string;
    displayName: string;
    profilePhoto?: string | null;
  } | null;
  onPostDeleted?: (postId: string) => void;
}

export const PostDetailModal: React.FC<PostDetailModalProps> = ({
  postId,
  isOpen,
  onClose,
  currentUser,
  onPostDeleted,
}) => {
  const [post, setPost] = useState<PostData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !postId) {
      setPost(null);
      setError(null);
      return;
    }

    const fetchPost = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/posts/${postId}`);
        if (res.ok) {
          const data = await res.json();
          // Also fetch recent comments
          const commRes = await fetch(`/api/posts/${postId}/comments`);
          const commData = commRes.ok ? await commRes.json() : { comments: [] };
          setPost({
            ...data.post,
            recentComments: commData.comments || [],
          });
        } else {
          setError("Post not found or has been deleted");
        }
      } catch (err: any) {
        setError("Failed to load post");
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [postId, isOpen]);

  if (!isOpen || !postId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg">
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/80"
        >
          <X className="h-5 w-5" />
        </button>

        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-2xl bg-white p-8 dark:bg-slate-900">
            <Loader2 className="h-8 w-8 animate-spin text-rose-600" />
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-white p-8 text-center dark:bg-slate-900">
            <p className="font-semibold text-slate-700 dark:text-slate-300">{error}</p>
            <button
              onClick={onClose}
              className="mt-4 text-xs font-bold text-rose-600 hover:underline"
            >
              Close
            </button>
          </div>
        ) : post ? (
          <PostCard
            post={post}
            currentUser={currentUser}
            onPostDeleted={(id) => {
              if (onPostDeleted) onPostDeleted(id);
              onClose();
            }}
          />
        ) : null}
      </div>
    </div>
  );
};
