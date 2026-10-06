// Realtime In-Memory Event Hub for LAN Server
// Provides instant event dispatch to connected clients via Server-Sent Events (SSE)

type EventListener = (data: { type: string; payload: any; timestamp: number }) => void;

class RealtimeHub {
  private listeners: Map<string, Set<EventListener>> = new Map();
  private activeStreams: Map<string, number> = new Map();

  /**
   * Subscribe a user's SSE stream to real-time events.
   */
  public subscribe(userId: string, listener: EventListener): () => void {
    if (!this.listeners.has(userId)) {
      this.listeners.set(userId, new Set());
    }
    this.listeners.get(userId)!.add(listener);

    const currentStreams = this.activeStreams.get(userId) || 0;
    this.activeStreams.set(userId, currentStreams + 1);

    // Return cleanup function
    return () => {
      const set = this.listeners.get(userId);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.listeners.delete(userId);
        }
      }

      const streams = (this.activeStreams.get(userId) || 1) - 1;
      if (streams <= 0) {
        this.activeStreams.delete(userId);
      } else {
        this.activeStreams.set(userId, streams);
      }
    };
  }

  /**
   * Send an event to a specific user's connected clients.
   */
  public emitToUser(userId: string, type: string, payload: any): void {
    const userListeners = this.listeners.get(userId);
    if (userListeners && userListeners.size > 0) {
      const event = {
        type,
        payload,
        timestamp: Date.now(),
      };
      userListeners.forEach((listener) => {
        try {
          listener(event);
        } catch (err) {
          console.error(`Error notifying listener for user ${userId}:`, err);
        }
      });
    }
  }

  /**
   * Broadcast an event to all connected users.
   */
  public broadcast(type: string, payload: any): void {
    const event = {
      type,
      payload,
      timestamp: Date.now(),
    };
    this.listeners.forEach((userListeners, userId) => {
      userListeners.forEach((listener) => {
        try {
          listener(event);
        } catch (err) {
          console.error(`Error broadcasting to user ${userId}:`, err);
        }
      });
    });
  }

  /**
   * Check if a user currently has at least one active SSE connection.
   */
  public isUserConnected(userId: string): boolean {
    return (this.activeStreams.get(userId) || 0) > 0;
  }
}

// Attach to globalThis to prevent multiple instances during Next.js hot module reloading
const globalForHub = globalThis as unknown as { realtimeHub: RealtimeHub };

export const realtimeHub = globalForHub.realtimeHub || new RealtimeHub();

if (process.env.NODE_ENV !== "production") {
  globalForHub.realtimeHub = realtimeHub;
}
