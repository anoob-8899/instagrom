"use client";

import React, { useState, useRef } from "react";
import { X, Upload, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface CreateStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStoryCreated: (story: any) => void;
}

export const CreateStoryModal: React.FC<CreateStoryModalProps> = ({
  isOpen,
  onClose,
  onStoryCreated,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (selectedFile: File | null) => {
    setError(null);
    if (!selectedFile) return;

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("Image cannot exceed 10MB");
      return;
    }

    setFile(selectedFile);
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
  };

  const handleClose = () => {
    if (!uploading) {
      setFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setCaption("");
      setError(null);
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      // 1. Upload story image
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", "stories");

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload story image");
      }

      const { url: mediaUrl } = await uploadRes.json();

      // 2. Save story to SQLite
      const storyRes = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaUrl,
          caption: caption.trim() || undefined,
        }),
      });

      if (!storyRes.ok) {
        throw new Error("Failed to create story");
      }

      const { story } = await storyRes.json();
      onStoryCreated(story);
      handleClose();
    } catch (err: any) {
      setError(err.message || "Failed to publish story");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="relative flex w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-rose-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Add to Story
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 p-2.5 text-center text-xs font-semibold text-red-600 dark:bg-red-950/50 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {previewUrl ? (
            <div className="relative aspect-[9/14] w-full overflow-hidden rounded-xl bg-black">
              <img
                src={previewUrl}
                alt="Story preview"
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setPreviewUrl(null);
                }}
                className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white backdrop-blur-sm"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex aspect-[9/14] w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 hover:border-rose-500 dark:border-slate-700 transition-colors p-4 text-center"
            >
              <Upload className="h-8 w-8 text-slate-400 mb-2" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Choose a photo for your Story
              </p>
              <p className="mt-1 text-[11px] text-slate-400">Shared across classroom LAN</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              />
            </div>
          )}

          <input
            type="text"
            placeholder="Add story text..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />

          <Button
            type="submit"
            variant="primary"
            className="w-full bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 text-white font-bold"
            disabled={!file || uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sharing Story...
              </>
            ) : (
              "Share to Story"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};
