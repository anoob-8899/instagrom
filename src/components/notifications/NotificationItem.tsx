"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, MessageCircle, UserPlus, Mail, Check } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils/cn";

export interface NotificationData {
  id: string;
  recipientId: string;
  actorId: string;
  type: "LIKE" | "COMMENT" | "FOLLOW" | "MESSAGE" | string;
  postId?: string | null;
  commentId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  readAt?: string | Date | null;
  createdAt: string | Date;
  actor: {
    id: string;
    username: string;
    displayName: string;
    profilePhoto?: string | null;
  };
  post?: {
    id: string;
    imageUrl: string;
    caption?: string | null;
  } | null;
}

interface NotificationItemProps {
  notification: NotificationData;
  onMarkAsRead: (id: string) => void;
}

function formatRelativeTime(dateInput: string | Date): string {
  const date = new Date(dateInput);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onMarkAsRead,
}) => {
  const isUnread = !notification.readAt;

  let actionText = "";
  let icon = null;
  let targetUrl = `/profile/${notification.actor.username}`;

  if (notification.type === "LIKE") {
    actionText = "liked your post";
    icon = <Heart className="h-3 w-3 text-white fill-rose-500" />;
    if (notification.postId) targetUrl = `/post/${notification.postId}`;
  } else if (notification.type === "COMMENT") {
    actionText = "commented on your post";
    icon = <MessageCircle className="h-3 w-3 text-white fill-blue-500" />;
    if (notification.postId) targetUrl = `/post/${notification.postId}`;
  } else if (notification.type === "FOLLOW") {
    actionText = "started following you";
    icon = <UserPlus className="h-3 w-3 text-white" />;
    targetUrl = `/profile/${notification.actor.username}`;
  } else if (notification.type === "MESSAGE") {
    actionText = "sent you a message";
    icon = <Mail className="h-3 w-3 text-white" />;
    if (notification.conversationId) targetUrl = `/messages/${notification.conversationId}`;
    else targetUrl = `/messages`;
  }

  const handleClick = () => {
    if (isUnread) {
      onMarkAsRead(notification.id);
    }
  };

  return (
    <div
      className={cn(
        "group flex items-center justify-between gap-3 p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/60",
        isUnread && "bg-blue-50/40 dark:bg-blue-950/20"
      )}
    >
      <Link
        href={targetUrl}
        onClick={handleClick}
        className="flex min-w-0 flex-1 items-center gap-3.5"
      >
        {/* Avatar with notification type badge */}
        <div className="relative shrink-0">
          <Avatar
            src={notification.actor.profilePhoto}
            fallbackName={notification.actor.displayName}
            size="md"
            className="h-11 w-11"
          />
          <div
            className={cn(
              "absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-white dark:ring-slate-950",
              notification.type === "LIKE" && "bg-rose-500",
              notification.type === "COMMENT" && "bg-blue-500",
              notification.type === "FOLLOW" && "bg-purple-500",
              notification.type === "MESSAGE" && "bg-emerald-500"
            )}
          >
            {icon}
          </div>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1 text-sm">
          <p className="leading-snug text-slate-800 dark:text-slate-200">
            <span className="font-bold text-slate-900 dark:text-white">
              {notification.actor.displayName}
            </span>{" "}
            <span className="text-slate-600 dark:text-slate-300">{actionText}</span>
          </p>
          <span className="text-xs text-slate-400">
            {formatRelativeTime(notification.createdAt)}
          </span>
        </div>
      </Link>

      {/* Post Thumbnail (if applicable) or Read Action */}
      <div className="flex items-center gap-2 shrink-0">
        {notification.post && (
          <Link
            href={`/post/${notification.post.id}`}
            onClick={handleClick}
            className="relative h-11 w-11 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={notification.post.imageUrl}
              alt="Post thumbnail"
              className="h-full w-full object-cover"
            />
          </Link>
        )}

        {isUnread && (
          <button
            onClick={() => onMarkAsRead(notification.id)}
            title="Mark as read"
            className="flex h-7 w-7 items-center justify-center rounded-full text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-950/60 transition-colors"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600 dark:bg-blue-400" />
          </button>
        )}
      </div>
    </div>
  );
};
