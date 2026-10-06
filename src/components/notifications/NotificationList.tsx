"use client";

import React from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { NotificationItem, NotificationData } from "./NotificationItem";

interface NotificationListProps {
  notifications: NotificationData[];
  isLoading?: boolean;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  isMarkingAll?: boolean;
}

export const NotificationList: React.FC<NotificationListProps> = ({
  notifications,
  isLoading,
  onMarkAsRead,
  onMarkAllAsRead,
  isMarkingAll,
}) => {
  const hasUnread = notifications.some((n) => !n.readAt);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-slate-800 dark:text-white" />
          <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
            Notifications
          </h1>
        </div>

        {hasUnread && (
          <button
            onClick={onMarkAllAsRead}
            disabled={isMarkingAll}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40 transition-colors disabled:opacity-50"
          >
            {isMarkingAll ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCheck className="h-3.5 w-3.5" />
            )}
            <span>Mark all as read</span>
          </button>
        )}
      </div>

      {/* List */}
      <div className="divide-y divide-slate-100 dark:divide-slate-900">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-900">
              <Bell className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-800 dark:text-slate-200">
              No notifications yet
            </h3>
            <p className="mt-1 text-xs text-slate-500 max-w-xs">
              When people like your posts, comment, follow you, or message you, you&apos;ll see updates here.
            </p>
          </div>
        ) : (
          notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkAsRead={onMarkAsRead}
            />
          ))
        )}
      </div>
    </div>
  );
};
