"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { NotificationList } from "@/components/notifications/NotificationList";
import { NotificationData } from "@/components/notifications/NotificationItem";
import { useRealtime } from "@/lib/realtime/RealtimeProvider";

interface NotificationsClientPageProps {
  currentUser: {
    id: string;
    username: string;
    displayName: string;
    profilePhoto?: string | null;
  };
  initialNotifications: NotificationData[];
}

export const NotificationsClientPage: React.FC<NotificationsClientPageProps> = ({
  currentUser,
  initialNotifications,
}) => {
  const [notifications, setNotifications] = useState<NotificationData[]>(initialNotifications);
  const [isLoading, setIsLoading] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const { addCustomEventListener, refreshUnreadCounts } = useRealtime();

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Listen for live incoming notifications
  useEffect(() => {
    const unsub = addCustomEventListener("NEW_NOTIFICATION", (payload: any) => {
      if (payload.notification) {
        setNotifications((prev) => [payload.notification, ...prev]);
        refreshUnreadCounts();
      }
    });

    return () => {
      unsub();
    };
  }, [addCustomEventListener, refreshUnreadCounts]);

  const handleMarkAsRead = async (id: string) => {
    try {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date() } : n))
      );

      await fetch(`/api/notifications/${id}/read`, {
        method: "PATCH",
      });
      refreshUnreadCounts();
    } catch {
      // Revert if error
      fetchNotifications();
    }
  };

  const handleMarkAllAsRead = async () => {
    setIsMarkingAll(true);
    try {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: new Date() }))
      );

      await fetch("/api/notifications/read-all", {
        method: "POST",
      });
      refreshUnreadCounts();
    } catch {
      fetchNotifications();
    } finally {
      setIsMarkingAll(false);
    }
  };

  return (
    <AppShell user={currentUser}>
      <div className="mx-auto max-w-2xl py-2">
        <NotificationList
          notifications={notifications}
          isLoading={isLoading}
          onMarkAsRead={handleMarkAsRead}
          onMarkAllAsRead={handleMarkAllAsRead}
          isMarkingAll={isMarkingAll}
        />
      </div>
    </AppShell>
  );
};
