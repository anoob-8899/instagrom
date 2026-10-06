"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Settings, UserPlus, UserCheck, Loader2, MessageCircle } from "lucide-react";

interface ProfileHeaderProps {
  user: {
    id: string;
    username: string;
    displayName: string;
    profilePhoto?: string | null;
    bio?: string | null;
    createdAt: string | Date;
    postCount: number;
    followerCount: number;
    followingCount: number;
    isFollowing: boolean;
    isSelf: boolean;
  };
  currentUser?: {
    id: string;
    username: string;
    displayName: string;
  } | null;
  onEditProfileClick: () => void;
  onFollowToggled?: (isFollowing: boolean, followerCount: number) => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  user,
  currentUser,
  onEditProfileClick,
  onFollowToggled,
}) => {
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState(user.isFollowing);
  const [followerCount, setFollowerCount] = useState(user.followerCount);
  const [followLoading, setFollowLoading] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);

  const handleFollowToggle = async () => {
    if (!currentUser || user.isSelf || followLoading) return;

    setFollowLoading(true);
    const nextFollowing = !isFollowing;
    const nextFollowers = nextFollowing ? followerCount + 1 : Math.max(0, followerCount - 1);

    setIsFollowing(nextFollowing);
    setFollowerCount(nextFollowers);

    try {
      const res = await fetch(`/api/users/${user.username}/follow`, {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        setIsFollowing(data.isFollowing);
        setFollowerCount(data.followerCount);
        if (onFollowToggled) {
          onFollowToggled(data.isFollowing, data.followerCount);
        }
      } else {
        // Rollback
        setIsFollowing(isFollowing);
        setFollowerCount(followerCount);
      }
    } catch {
      // Rollback
      setIsFollowing(isFollowing);
      setFollowerCount(followerCount);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleOpenChat = async () => {
    if (!currentUser || user.isSelf || messageLoading) return;

    setMessageLoading(true);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: user.id }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/messages/${data.conversation.id}`);
      }
    } catch (err) {
      console.error("Error creating conversation:", err);
    } finally {
      setMessageLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-12 pb-8 border-b border-slate-200 dark:border-slate-800">
      {/* Avatar */}
      <div className="flex justify-center md:justify-start shrink-0">
        <Avatar
          src={user.profilePhoto}
          fallbackName={user.displayName}
          size="2xl"
          className="h-24 w-24 sm:h-32 sm:w-32 ring-4 ring-slate-100 dark:ring-slate-800"
        />
      </div>

      {/* Info & Stats */}
      <div className="flex-1 space-y-4 text-center md:text-left">
        {/* Username & Action Buttons */}
        <div className="flex flex-col items-center gap-3 md:flex-row md:items-center">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            @{user.username}
          </h1>

          <div className="flex items-center gap-2">
            {user.isSelf ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onEditProfileClick}
                className="font-semibold text-xs"
              >
                <Settings className="mr-1.5 h-3.5 w-3.5" />
                Edit Profile
              </Button>
            ) : currentUser ? (
              <>
                <Button
                  variant={isFollowing ? "outline" : "primary"}
                  size="sm"
                  onClick={handleFollowToggle}
                  disabled={followLoading}
                  className={`font-semibold text-xs min-w-[100px] ${
                    isFollowing
                      ? "border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  {followLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : isFollowing ? (
                    <>
                      <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                      Following
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                      Follow
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenChat}
                  disabled={messageLoading}
                  className="font-semibold text-xs border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200"
                >
                  {messageLoading ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Message
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {/* Counts Row */}
        <div className="flex justify-center gap-8 md:justify-start text-sm">
          <div>
            <span className="font-black text-slate-900 dark:text-white">
              {user.postCount}
            </span>{" "}
            <span className="text-slate-500 dark:text-slate-400">
              {user.postCount === 1 ? "post" : "posts"}
            </span>
          </div>
          <div>
            <span className="font-black text-slate-900 dark:text-white">
              {followerCount}
            </span>{" "}
            <span className="text-slate-500 dark:text-slate-400">
              {followerCount === 1 ? "follower" : "followers"}
            </span>
          </div>
          <div>
            <span className="font-black text-slate-900 dark:text-white">
              {user.followingCount}
            </span>{" "}
            <span className="text-slate-500 dark:text-slate-400">following</span>
          </div>
        </div>

        {/* Display Name & Bio */}
        <div className="space-y-1">
          <p className="font-bold text-sm text-slate-900 dark:text-white">
            {user.displayName}
          </p>
          {user.bio ? (
            <p className="whitespace-pre-wrap text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-lg">
              {user.bio}
            </p>
          ) : (
            <p className="text-xs italic text-slate-400">No bio provided</p>
          )}
        </div>
      </div>
    </div>
  );
};
