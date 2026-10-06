"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Camera,
  Heart,
  Home,
  LogOut,
  MessageCircle,
  PlusSquare,
  Search,
  User as UserIcon,
  Wifi,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useRealtime } from "@/lib/realtime/RealtimeProvider";
import { cn } from "@/lib/utils/cn";

interface SidebarProps {
  user?: {
    id: string;
    username: string;
    displayName: string;
    profilePhoto?: string | null;
  } | null;
  onCreatePostClick: () => void;
  onSearchClick?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  onCreatePostClick,
  onSearchClick,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const { unreadNotifications, unreadMessages } = useRealtime();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    }
  };

  const navItems = [
    {
      label: "Home",
      href: "/feed",
      icon: Home,
      isActive: pathname === "/feed",
    },
    {
      label: "Search",
      href: "#",
      icon: Search,
      onClick: onSearchClick,
      isActive: pathname === "/search",
    },
    {
      label: "Messages",
      href: "/messages",
      icon: MessageCircle,
      isActive: pathname.startsWith("/messages"),
      badgeCount: unreadMessages,
    },
    {
      label: "Notifications",
      href: "/notifications",
      icon: Bell,
      isActive: pathname === "/notifications",
      badgeCount: unreadNotifications,
    },
    {
      label: "Create",
      href: "#",
      icon: PlusSquare,
      onClick: onCreatePostClick,
      isButton: true,
    },
    {
      label: "Profile",
      href: user ? `/profile/${user.username}` : "/login",
      icon: UserIcon,
      isActive: user ? pathname === `/profile/${user.username}` : false,
      avatar: user
        ? {
            src: user.profilePhoto,
            fallbackName: user.displayName,
          }
        : null,
    },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col justify-between border-r border-slate-200 bg-white px-4 py-6 dark:border-slate-800 dark:bg-slate-950 md:flex lg:w-64">
      <div className="space-y-6">
        {/* Brand */}
        <Link href="/feed" className="flex items-center gap-3 px-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 text-white shadow-sm transition-transform group-hover:scale-105">
            <Camera className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
              INSTAGROM
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Shared LAN Feed
            </span>
          </div>
        </Link>

        {/* Navigation Items */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const content = (
              <div
                className={cn(
                  "flex items-center justify-between rounded-xl px-3.5 py-3 text-sm font-semibold transition-colors hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer",
                  item.isActive
                    ? "bg-slate-100/90 text-slate-950 dark:bg-slate-900 dark:text-white font-bold"
                    : "text-slate-600 dark:text-slate-400"
                )}
              >
                <div className="flex items-center gap-3.5">
                  {item.avatar ? (
                    <Avatar
                      src={item.avatar.src}
                      fallbackName={item.avatar.fallbackName}
                      size="xs"
                      className="h-6 w-6"
                    />
                  ) : (
                    <Icon
                      className={cn(
                        "h-6 w-6 shrink-0",
                        item.isActive
                          ? "stroke-[2.5px] text-rose-600 dark:text-rose-400"
                          : "stroke-[1.75px]"
                      )}
                    />
                  )}
                  <span>{item.label}</span>
                </div>

                {item.badgeCount && item.badgeCount > 0 ? (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-bold text-white shadow-xs">
                    {item.badgeCount > 99 ? "99+" : item.badgeCount}
                  </span>
                ) : null}
              </div>
            );

            if (item.onClick) {
              return (
                <button
                  key={item.label}
                  onClick={(e) => {
                    e.preventDefault();
                    item.onClick!();
                  }}
                  className="w-full text-left"
                >
                  {content}
                </button>
              );
            }

            return (
              <Link key={item.label} href={item.href}>
                {content}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Info & LAN indicator at bottom */}
      <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
          <Wifi className="h-4 w-4 shrink-0 animate-pulse text-emerald-500" />
          <span className="truncate">Host SQLite Connected</span>
        </div>

        {user && (
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 dark:bg-slate-900/60">
            <Link
              href={`/profile/${user.username}`}
              className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-80 transition-opacity"
            >
              <Avatar
                src={user.profilePhoto}
                fallbackName={user.displayName}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                  {user.displayName}
                </p>
                <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                  @{user.username}
                </p>
              </div>
            </Link>

            <button
              onClick={handleLogout}
              title="Log Out"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-red-600 dark:hover:bg-slate-800 dark:hover:text-red-400 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
