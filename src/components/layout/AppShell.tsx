"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Camera, PlusSquare, Search, Wifi } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { CreatePostModal } from "@/components/feed/CreatePostModal";
import { SearchDrawer } from "@/components/search/SearchDrawer";
import { RealtimeProvider } from "@/lib/realtime/RealtimeProvider";

interface AppShellProps {
  children: React.ReactNode;
  user: {
    id: string;
    username: string;
    displayName: string;
    profilePhoto?: string | null;
  };
  onPostCreated?: (post: any) => void;
  onPostSelect?: (postId: string) => void;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  user,
  onPostCreated,
  onPostSelect,
}) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const handlePostCreated = (newPost: any) => {
    if (onPostCreated) {
      onPostCreated(newPost);
    }
  };

  return (
    <RealtimeProvider userId={user?.id}>
      <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {/* 1. Desktop Sidebar */}
        <Sidebar
          user={user}
          onCreatePostClick={() => setIsCreateOpen(true)}
          onSearchClick={() => setIsSearchOpen(true)}
        />

        {/* 2. Mobile Top Bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 md:hidden">
          <Link href="/feed" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 text-white">
              <Camera className="h-4 w-4" />
            </div>
            <span className="text-base font-black tracking-tight text-slate-900 dark:text-white">
              INSTAGROM
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
              <Wifi className="h-3 w-3 animate-pulse text-emerald-500" />
              <span>LAN</span>
            </div>

            <button
              onClick={() => setIsCreateOpen(true)}
              className="p-1 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              <PlusSquare className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* 3. Main Content Container */}
        <div className="md:pl-64 pb-16 md:pb-8">
          <div className="mx-auto max-w-5xl px-3 py-4 sm:px-6 sm:py-6">
            {children}
          </div>
        </div>

        {/* 4. Mobile Bottom Navigation */}
        <BottomNav
          user={user}
          onCreatePostClick={() => setIsCreateOpen(true)}
          onSearchClick={() => setIsSearchOpen(true)}
        />

        {/* 5. Modals */}
        <CreatePostModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          currentUser={user}
          onPostCreated={handlePostCreated}
        />

        <SearchDrawer
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onSelectPost={onPostSelect}
        />
      </div>
    </RealtimeProvider>
  );
};
