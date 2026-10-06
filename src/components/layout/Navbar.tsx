"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, LogOut, Loader2, User as UserIcon, Wifi } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface NavbarProps {
  user?: {
    username: string;
    displayName: string;
    profilePhoto?: string | null;
  } | null;
}

export const Navbar: React.FC<NavbarProps> = ({ user }) => {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-slate-800 dark:bg-slate-900/95">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <Link href="/feed" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 text-white shadow-sm transition-transform group-hover:scale-105">
            <Camera className="h-5 w-5" />
          </div>
          <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
            INSTAGROM
          </span>
        </Link>

        {/* LAN Badge & User info */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-400 sm:flex">
            <Wifi className="h-3.5 w-3.5 animate-pulse text-emerald-500" />
            <span>LAN Network Active</span>
          </div>

          {user && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
                  <UserIcon className="h-4 w-4" />
                </div>
                <div className="hidden text-left sm:block">
                  <p className="text-xs font-bold leading-none text-slate-900 dark:text-white">
                    {user.displayName}
                  </p>
                  <p className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">
                    @{user.username}
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex items-center gap-1.5 text-xs text-slate-700 hover:text-red-600 dark:text-slate-300 dark:hover:text-red-400"
              >
                {loggingOut ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LogOut className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">Log out</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
