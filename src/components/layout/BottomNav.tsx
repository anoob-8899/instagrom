"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Home, MessageCircle, PlusSquare, Search, User as UserIcon } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useRealtime } from "@/lib/realtime/RealtimeProvider";
import { cn } from "@/lib/utils/cn";

interface BottomNavProps {
  user?: {
    username: string;
    displayName: string;
    profilePhoto?: string | null;
  } | null;
  onCreatePostClick: () => void;
  onSearchClick: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  user,
  onCreatePostClick,
  onSearchClick,
}) => {
  const pathname = usePathname();
  const { unreadNotifications, unreadMessages } = useRealtime();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-14 items-center justify-around border-t border-slate-200 bg-white/95 px-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 md:hidden">
      {/* Home */}
      <Link
        href="/feed"
        className={cn(
          "flex flex-col items-center justify-center p-2 text-slate-600 dark:text-slate-400",
          pathname === "/feed" && "text-rose-600 dark:text-rose-400"
        )}
      >
        <Home className={cn("h-6 w-6", pathname === "/feed" && "stroke-[2.5px]")} />
        <span className="sr-only">Home</span>
      </Link>

      {/* Search */}
      <button
        type="button"
        onClick={onSearchClick}
        className={cn(
          "flex flex-col items-center justify-center p-2 text-slate-600 dark:text-slate-400",
          pathname === "/search" && "text-rose-600 dark:text-rose-400"
        )}
      >
        <Search className="h-6 w-6" />
        <span className="sr-only">Search</span>
      </button>

      {/* Create Post */}
      <button
        type="button"
        onClick={onCreatePostClick}
        className="flex flex-col items-center justify-center p-2 text-slate-700 dark:text-slate-300 active:scale-95 transition-transform"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-950">
          <PlusSquare className="h-4.5 w-4.5" />
        </div>
        <span className="sr-only">Create Post</span>
      </button>

      {/* Notifications */}
      <Link
        href="/notifications"
        className={cn(
          "relative flex flex-col items-center justify-center p-2 text-slate-600 dark:text-slate-400",
          pathname === "/notifications" && "text-rose-600 dark:text-rose-400"
        )}
      >
        <Bell className={cn("h-6 w-6", pathname === "/notifications" && "stroke-[2.5px]")} />
        {unreadNotifications > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white">
            {unreadNotifications > 9 ? "9+" : unreadNotifications}
          </span>
        )}
        <span className="sr-only">Notifications</span>
      </Link>

      {/* Messages */}
      <Link
        href="/messages"
        className={cn(
          "relative flex flex-col items-center justify-center p-2 text-slate-600 dark:text-slate-400",
          pathname.startsWith("/messages") && "text-rose-600 dark:text-rose-400"
        )}
      >
        <MessageCircle className={cn("h-6 w-6", pathname.startsWith("/messages") && "stroke-[2.5px]")} />
        {unreadMessages > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white">
            {unreadMessages > 9 ? "9+" : unreadMessages}
          </span>
        )}
        <span className="sr-only">Messages</span>
      </Link>

      {/* Profile */}
      <Link
        href={user ? `/profile/${user.username}` : "/login"}
        className={cn(
          "flex flex-col items-center justify-center p-2 text-slate-600 dark:text-slate-400",
          user && pathname === `/profile/${user.username}` && "text-rose-600 dark:text-rose-400"
        )}
      >
        {user ? (
          <Avatar
            src={user.profilePhoto}
            fallbackName={user.displayName}
            size="xs"
            className={cn(
              "h-6 w-6 ring-2",
              pathname === `/profile/${user.username}`
                ? "ring-rose-500"
                : "ring-transparent"
            )}
          />
        ) : (
          <UserIcon className="h-6 w-6" />
        )}
        <span className="sr-only">Profile</span>
      </Link>
    </nav>
  );
};
