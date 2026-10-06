"use client";

import React, { useState, useRef } from "react";
import { X, Upload, Image as ImageIcon, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: {
    id: string;
    username: string;
    displayName: string;
    profilePhoto?: string | null;
  };
  onPostCreated: (post: any) => void;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onPostCreated,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (selectedFile: File | null) => {
    setError(null);
    if (!selectedFile) return;

    // Validate size (10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("File size cannot exceed 10MB");
      return;
    }

    // Validate type
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(selectedFile.type)) {
      setError("Only JPEG, PNG, WEBP, and GIF images are supported");
      return;
    }

    setFile(selectedFile);
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const resetForm = () => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setCaption("");
    setError(null);
    setUploading(false);
  };

  const handleClose = () => {
    if (!uploading) {
      resetForm();
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select an image to post");
      return;
    }

    setError(null);
    setUploading(true);

    try {
      // 1. Upload the image to local host storage
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", "posts");

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const data = await uploadRes.json();
        throw new Error(data.error || "Failed to upload image to host");
      }

      const { url: imageUrl } = await uploadRes.json();

      // 2. Create the post in SQLite
      const postRes = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl,
          caption: caption.trim() || undefined,
        }),
      });

      if (!postRes.ok) {
        const data = await postRes.json();
        throw new Error(data.error || "Failed to publish post");
      }

      const { post } = await postRes.json();
      onPostCreated(post);
      handleClose();
    } catch (err: any) {
      console.error("Create post error:", err);
      setError(err.message || "An unexpected error occurred");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Create new post
          </h2>
          <button
            onClick={handleClose}
            disabled={uploading}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 px-5 py-2.5 text-xs font-semibold text-red-600 dark:bg-red-950/50 dark:text-red-400 border-b border-red-100 dark:border-red-900/50">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row min-h-[380px]">
          {/* Left: Image selector / preview */}
          <div className="relative flex flex-1 items-center justify-center bg-slate-50 p-4 dark:bg-slate-950/50 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 min-h-[260px] md:min-h-0">
            {previewUrl ? (
              <div className="relative h-full w-full max-h-[360px] flex items-center justify-center">
                <img
                  src={previewUrl}
                  alt="Post preview"
                  className="max-h-[340px] w-full rounded-xl object-contain shadow-sm"
                />
                {!uploading && (
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setPreviewUrl(null);
                    }}
                    className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white backdrop-blur-sm hover:bg-black/80 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex h-full w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                  dragOver
                    ? "border-rose-500 bg-rose-50/50 dark:bg-rose-950/20"
                    : "border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-600"
                }`}
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 mb-3">
                  <ImageIcon className="h-7 w-7" />
                </div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  Drag photos here
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Supports JPEG, PNG, WEBP, GIF up to 10MB
                </p>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  className="mt-4"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Select from device
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                />
              </div>
            )}
          </div>

          {/* Right: Author info & Caption */}
          <div className="flex w-full md:w-72 flex-col justify-between p-4 dark:bg-slate-900">
            <div className="space-y-4">
              {/* User details */}
              <div className="flex items-center gap-3">
                <Avatar
                  src={currentUser.profilePhoto}
                  fallbackName={currentUser.displayName}
                  size="sm"
                />
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    {currentUser.displayName}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    @{currentUser.username}
                  </p>
                </div>
              </div>

              {/* Caption */}
              <div className="space-y-1.5">
                <textarea
                  rows={5}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Write a caption... (use #hashtags)"
                  maxLength={2200}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-rose-500 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white dark:focus:bg-slate-800"
                />
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Host storage</span>
                  <span>{caption.length} / 2,200</span>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <Button
                type="submit"
                variant="primary"
                className="w-full bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-700 hover:to-indigo-700 text-white font-bold py-2.5 rounded-xl shadow-md"
                disabled={!file || uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Publishing to LAN...
                  </>
                ) : (
                  "Share Post"
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
