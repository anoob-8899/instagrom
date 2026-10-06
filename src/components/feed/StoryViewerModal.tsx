"use client";

import React, { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";

interface StoryUserGroup {
  author: {
    id: string;
    username: string;
    displayName: string;
    profilePhoto?: string | null;
  };
  stories: Array<{
    id: string;
    mediaUrl: string;
    caption?: string | null;
    createdAt: string | Date;
  }>;
}

interface StoryViewerModalProps {
  groups: StoryUserGroup[];
  initialGroupIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

export const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  groups,
  initialGroupIndex,
  isOpen,
  onClose,
}) => {
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setGroupIndex(initialGroupIndex);
    setStoryIndex(0);
    setProgress(0);
  }, [initialGroupIndex, isOpen]);

  const currentGroup = groups[groupIndex];
  const currentStory = currentGroup?.stories[storyIndex];

  // Auto progression timer (5s per story)
  useEffect(() => {
    if (!isOpen || !currentStory) return;

    setProgress(0);
    const intervalTime = 50; // ms
    const duration = 5000; // 5000ms
    const step = (intervalTime / duration) * 100;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          handleNext();
          return 0;
        }
        return prev + step;
      });
    }, intervalTime);

    return () => clearInterval(interval);
  }, [groupIndex, storyIndex, isOpen, currentStory]);

  const handleNext = () => {
    if (!currentGroup) return;

    if (storyIndex < currentGroup.stories.length - 1) {
      setStoryIndex((prev) => prev + 1);
      setProgress(0);
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex((prev) => prev + 1);
      setStoryIndex(0);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (storyIndex > 0) {
      setStoryIndex((prev) => prev - 1);
      setProgress(0);
    } else if (groupIndex > 0) {
      setGroupIndex((prev) => prev - 1);
      const prevGroup = groups[groupIndex - 1];
      setStoryIndex(prevGroup ? prevGroup.stories.length - 1 : 0);
      setProgress(0);
    }
  };

  if (!isOpen || !currentGroup || !currentStory) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2 sm:p-4 backdrop-blur-md">
      <div className="relative flex h-full max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-black shadow-2xl">
        {/* Progress bars for stories of this author */}
        <div className="absolute left-3 right-3 top-3 z-30 flex gap-1">
          {currentGroup.stories.map((s, idx) => (
            <div
              key={s.id}
              className="h-1 flex-1 overflow-hidden rounded-full bg-white/30"
            >
              <div
                className="h-full bg-white transition-all duration-75"
                style={{
                  width:
                    idx < storyIndex
                      ? "100%"
                      : idx === storyIndex
                      ? `${progress}%`
                      : "0%",
                }}
              />
            </div>
          ))}
        </div>

        {/* Top Header */}
        <div className="absolute left-3 right-3 top-6 z-30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar
              src={currentGroup.author.profilePhoto}
              fallbackName={currentGroup.author.displayName}
              size="sm"
            />
            <span className="text-xs font-bold text-white drop-shadow">
              {currentGroup.author.username}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-black/40 p-1.5 text-white hover:bg-black/60 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Story Image */}
        <div className="relative h-full w-full flex items-center justify-center">
          <img
            src={currentStory.mediaUrl}
            alt={currentStory.caption || "Story image"}
            className="h-full w-full object-contain select-none"
          />

          {/* Left/Right click zones */}
          <div
            onClick={handlePrev}
            className="absolute inset-y-0 left-0 w-1/3 cursor-pointer"
          />
          <div
            onClick={handleNext}
            className="absolute inset-y-0 right-0 w-1/3 cursor-pointer"
          />
        </div>

        {/* Story Caption */}
        {currentStory.caption && (
          <div className="absolute bottom-6 left-4 right-4 z-30 rounded-xl bg-black/60 p-3 text-center text-xs font-medium text-white backdrop-blur-sm">
            {currentStory.caption}
          </div>
        )}

        {/* Prev / Next controls */}
        {groupIndex > 0 || storyIndex > 0 ? (
          <button
            onClick={handlePrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1 text-white hover:bg-black/70"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        ) : null}

        <button
          onClick={handleNext}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1 text-white hover:bg-black/70"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
};
