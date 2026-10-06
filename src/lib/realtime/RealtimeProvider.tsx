"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";

export interface RealtimeEvent {
  type: string;
  payload: any;
  timestamp: number;
}

interface RealtimeContextType {
  isConnected: boolean;
  isReconnecting: boolean;
  unreadNotifications: number;
  unreadMessages: number;
  refreshUnreadCounts: () => Promise<void>;
  addCustomEventListener: (eventType: string, handler: (payload: any) => void) => () => void;
}

const RealtimeContext = createContext<RealtimeContextType>({
  isConnected: false,
  isReconnecting: false,
  unreadNotifications: 0,
  unreadMessages: 0,
  refreshUnreadCounts: async () => {},
  addCustomEventListener: () => () => {},
});

export const useRealtime = () => useContext(RealtimeContext);

export const RealtimeProvider: React.FC<{
  children: React.ReactNode;
  userId?: string;
}> = ({ children, userId }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const listenersRef = useRef<Map<string, Set<(payload: any) => void>>>(new Map());
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const refreshUnreadCounts = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch("/api/notifications/unread-count");
      if (res.ok) {
        const data = await res.json();
        setUnreadNotifications(data.unreadNotifications || 0);
        setUnreadMessages(data.unreadMessages || 0);
      }
    } catch {
      // Ignore background fetch error
    }
  }, [userId]);

  const addCustomEventListener = useCallback(
    (eventType: string, handler: (payload: any) => void) => {
      if (!listenersRef.current.has(eventType)) {
        listenersRef.current.set(eventType, new Set());
      }
      listenersRef.current.get(eventType)!.add(handler);

      return () => {
        const set = listenersRef.current.get(eventType);
        if (set) {
          set.delete(handler);
        }
      };
    },
    []
  );

  // Send periodic presence heartbeat
  useEffect(() => {
    if (!userId) return;

    const sendHeartbeat = async () => {
      try {
        await fetch("/api/presence/heartbeat", { method: "POST" });
      } catch {
        // Ignore heartbeat error
      }
    };

    // Initial heartbeat
    sendHeartbeat();
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, 20000);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [userId]);

  // Connect to SSE stream
  useEffect(() => {
    if (!userId) {
      setIsConnected(false);
      return;
    }

    refreshUnreadCounts();

    let isMounted = true;

    const connect = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const es = new EventSource("/api/realtime/stream");
      eventSourceRef.current = es;

      es.onopen = () => {
        if (!isMounted) return;
        setIsConnected(true);
        setIsReconnecting(false);
        // Refresh counts from SQLite on reconnection
        refreshUnreadCounts();
      };

      es.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const data: RealtimeEvent = JSON.parse(event.data);

          if (data.type === "PING") {
            return;
          }

          if (data.type === "NEW_MESSAGE") {
            setUnreadMessages((prev) => prev + 1);
          } else if (data.type === "NEW_NOTIFICATION") {
            setUnreadNotifications((prev) => prev + 1);
          } else if (data.type === "MESSAGE_READ") {
            refreshUnreadCounts();
          }

          // Trigger subscribed custom event listeners
          const handlers = listenersRef.current.get(data.type);
          if (handlers) {
            handlers.forEach((h) => {
              try {
                h(data.payload);
              } catch (e) {
                console.error("Error executing realtime event handler:", e);
              }
            });
          }
        } catch {
          // Parse error or non-JSON message
        }
      };

      es.onerror = () => {
        if (!isMounted) return;
        setIsConnected(false);
        setIsReconnecting(true);
        es.close();

        // Attempt reconnection after 3 seconds
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMounted) {
            connect();
          }
        }, 3000);
      };
    };

    connect();

    // Fallback periodic sync every 15s to guarantee fresh unread counts
    const fallbackSync = setInterval(refreshUnreadCounts, 15000);

    return () => {
      isMounted = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      clearInterval(fallbackSync);
    };
  }, [userId, refreshUnreadCounts]);

  return (
    <RealtimeContext.Provider
      value={{
        isConnected,
        isReconnecting,
        unreadNotifications,
        unreadMessages,
        refreshUnreadCounts,
        addCustomEventListener,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
};
