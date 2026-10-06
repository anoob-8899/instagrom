import { prisma } from "@/lib/db/prisma";
import { realtimeHub } from "@/lib/realtime/hub";

// In-memory throttling cache: maps userId -> timestamp of last DB write
const lastDbWriteCache = new Map<string, number>();
const DB_WRITE_THROTTLE_MS = 15000; // write to SQLite at most once per 15 seconds per user
const ONLINE_THRESHOLD_MS = 60000; // user is online if heartbeat within last 60 seconds

/**
 * Record a presence heartbeat for a user.
 * Throttles database writes to prevent SQLite saturation.
 */
export async function recordPresenceHeartbeat(userId: string): Promise<void> {
  const now = Date.now();
  const lastWrite = lastDbWriteCache.get(userId) || 0;

  if (now - lastWrite >= DB_WRITE_THROTTLE_MS) {
    lastDbWriteCache.set(userId, now);
    try {
      await prisma.userPresence.upsert({
        where: { userId },
        update: {
          lastSeenAt: new Date(now),
          isOnline: true,
        },
        create: {
          userId,
          lastSeenAt: new Date(now),
          isOnline: true,
        },
      });
    } catch (err) {
      console.error("Error updating user presence in SQLite:", err);
    }
  }
}

/**
 * Check the online status and last seen timestamp for a list of user IDs.
 */
export async function getUsersPresence(userIds: string[]): Promise<
  Record<
    string,
    {
      isOnline: boolean;
      lastSeenAt: Date | null;
      statusText: string;
    }
  >
> {
  if (userIds.length === 0) return {};

  const presences = await prisma.userPresence.findMany({
    where: {
      userId: { in: userIds },
    },
  });

  const presenceMap = new Map(presences.map((p) => [p.userId, p]));
  const result: Record<
    string,
    {
      isOnline: boolean;
      lastSeenAt: Date | null;
      statusText: string;
    }
  > = {};

  const now = Date.now();

  for (const uid of userIds) {
    const record = presenceMap.get(uid);
    const hasSse = realtimeHub.isUserConnected(uid);

    let isOnline = false;
    let lastSeenAt: Date | null = record?.lastSeenAt || null;

    if (hasSse) {
      isOnline = true;
    } else if (record && record.lastSeenAt) {
      const timeDiff = now - new Date(record.lastSeenAt).getTime();
      isOnline = timeDiff < ONLINE_THRESHOLD_MS;
    }

    let statusText = "Offline";
    if (isOnline) {
      statusText = "Online";
    } else if (lastSeenAt) {
      const mins = Math.floor((now - new Date(lastSeenAt).getTime()) / 60000);
      if (mins < 1) {
        statusText = "Active just now";
      } else if (mins < 60) {
        statusText = `Active ${mins}m ago`;
      } else {
        const hours = Math.floor(mins / 60);
        if (hours < 24) {
          statusText = `Active ${hours}h ago`;
        } else {
          statusText = "Offline";
        }
      }
    }

    result[uid] = {
      isOnline,
      lastSeenAt,
      statusText,
    };
  }

  return result;
}
