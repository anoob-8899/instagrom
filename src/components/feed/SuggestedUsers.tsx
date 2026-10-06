"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Users, Wifi, HardDrive } from "lucide-react";

interface SuggestedUsersProps {
  currentUser?: {
    id: string;
    username: string;
    displayName: string;
    profilePhoto?: string | null;
  } | null;
}

export const SuggestedUsers: React.FC<SuggestedUsersProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchSuggested = async () => {
      try {
        const res = await fetch("/api/users/suggested");
        if (res.ok) {
          const data = await res.json();
          setUsers(data.users || []);
          const map: Record<string, boolean> = {};
          data.users.forEach((u: any) => {
            map[u.username] = u.isFollowing;
          });
          setFollowingMap(map);
        }
      } catch (err) {
        console.error("Suggested users error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSuggested();
  }, []);

  const handleFollowToggle = async (username: string) => {
    const currentStatus = followingMap[username];
    // Optimistic toggle
    setFollowingMap((prev) => ({ ...prev, [username]: !currentStatus }));

    try {
      const res = await fetch(`/api/users/${username}/follow`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setFollowingMap((prev) => ({ ...prev, [username]: data.isFollowing }));
      } else {
        // Rollback
        setFollowingMap((prev) => ({ ...prev, [username]: currentStatus }));
      }
    } catch {
      setFollowingMap((prev) => ({ ...prev, [username]: currentStatus }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Current User Card */}
      {currentUser && (
        <div className="flex items-center justify-between">
          <Link
            href={`/profile/${currentUser.username}`}
            className="flex items-center gap-3 group"
          >
            <Avatar
              src={currentUser.profilePhoto}
              fallbackName={currentUser.displayName}
              size="md"
            />
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-slate-900 group-hover:underline dark:text-white">
                {currentUser.displayName}
              </p>
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                @{currentUser.username}
              </p>
            </div>
          </Link>
          <Link
            href={`/profile/${currentUser.username}`}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Profile
          </Link>
        </div>
      )}

      {/* Suggested Users */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
            Suggested for you
          </span>
          <span className="text-[11px] font-medium text-slate-400">Classroom LAN</span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-800" />
                  <div className="space-y-1">
                    <div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-800" />
                    <div className="h-2.5 w-14 rounded bg-slate-200 dark:bg-slate-800" />
                  </div>
                </div>
                <div className="h-4 w-12 rounded bg-slate-200 dark:bg-slate-800" />
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <p className="text-xs text-slate-400">No other classroom accounts registered yet.</p>
        ) : (
          <div className="space-y-3">
            {users.map((user) => {
              const isFollowing = followingMap[user.username] ?? user.isFollowing;
              return (
                <div key={user.id} className="flex items-center justify-between">
                  <Link
                    href={`/profile/${user.username}`}
                    className="flex items-center gap-2.5 min-w-0 flex-1 group mr-2"
                  >
                    <Avatar
                      src={user.profilePhoto}
                      fallbackName={user.displayName}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-900 group-hover:underline dark:text-white">
                        {user.displayName}
                      </p>
                      <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                        @{user.username}
                      </p>
                    </div>
                  </Link>

                  <button
                    onClick={() => handleFollowToggle(user.username)}
                    className={`text-xs font-bold transition-colors ${
                      isFollowing
                        ? "text-slate-500 hover:text-red-600 dark:text-slate-400"
                        : "text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    }`}
                  >
                    {isFollowing ? "Following" : "Follow"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Network & Host Status info */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 space-y-1.5">
        <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
          <Wifi className="h-3.5 w-3.5 text-emerald-500" />
          <span>INSTAGROM Classroom Network</span>
        </div>
        <p className="text-[10px] text-slate-400">
          Shared SQLite database at <code className="font-mono">data/instagrom.sqlite</code>.
          Changes sync live across all connected devices.
        </p>
      </div>
    </div>
  );
};
