"use client";

import React, { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { CreateStoryModal } from "./CreateStoryModal";
import { StoryViewerModal } from "./StoryViewerModal";

interface StoriesTrayProps {
  currentUser?: {
    id: string;
    username: string;
    displayName: string;
    profilePhoto?: string | null;
  } | null;
}

export const StoriesTray: React.FC<StoriesTrayProps> = ({ currentUser }) => {
  const [storyGroups, setStoryGroups] = useState<any[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeViewerIndex, setActiveViewerIndex] = useState<number | null>(null);

  const fetchStories = async () => {
    try {
      const res = await fetch("/api/stories");
      if (res.ok) {
        const data = await res.json();
        setStoryGroups(data.stories || []);
      }
    } catch (err) {
      console.error("Fetch stories error:", err);
    }
  };

  useEffect(() => {
    fetchStories();
  }, []);

  const handleStoryCreated = () => {
    fetchStories();
  };

  // Find if currentUser has a story
  const myStoryGroup = storyGroups.find((g) => g.author.id === currentUser?.id);
  const otherStoryGroups = storyGroups.filter((g) => g.author.id !== currentUser?.id);

  return (
    <>
      <div className="flex items-center gap-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 no-scrollbar">
        {/* Your Story item */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <div className="relative">
            <button
              onClick={() => {
                if (myStoryGroup) {
                  const idx = storyGroups.findIndex((g) => g.author.id === currentUser?.id);
                  setActiveViewerIndex(idx);
                } else {
                  setIsCreateOpen(true);
                }
              }}
              className="focus:outline-none"
            >
              <Avatar
                src={currentUser?.profilePhoto}
                fallbackName={currentUser?.displayName}
                size="md"
                hasStory={!!myStoryGroup}
              />
            </button>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white ring-2 ring-white dark:ring-slate-900 hover:bg-blue-700"
              title="Add Story"
            >
              <Plus className="h-3 w-3 stroke-[3px]" />
            </button>
          </div>
          <span className="max-w-[64px] truncate text-[11px] font-medium text-slate-700 dark:text-slate-300">
            Your story
          </span>
        </div>

        {/* Other Users' Stories */}
        {otherStoryGroups.map((group) => {
          const originalIndex = storyGroups.findIndex((g) => g.author.id === group.author.id);
          return (
            <button
              key={group.author.id}
              onClick={() => setActiveViewerIndex(originalIndex)}
              className="flex flex-col items-center gap-1 shrink-0 focus:outline-none group"
            >
              <Avatar
                src={group.author.profilePhoto}
                fallbackName={group.author.displayName}
                size="md"
                hasStory={true}
              />
              <span className="max-w-[64px] truncate text-[11px] font-medium text-slate-700 group-hover:underline dark:text-slate-300">
                {group.author.username}
              </span>
            </button>
          );
        })}
      </div>

      <CreateStoryModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onStoryCreated={handleStoryCreated}
      />

      {activeViewerIndex !== null && (
        <StoryViewerModal
          groups={storyGroups}
          initialGroupIndex={activeViewerIndex}
          isOpen={true}
          onClose={() => setActiveViewerIndex(null)}
        />
      )}
    </>
  );
};
