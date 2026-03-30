import Redis from "ioredis";

/** Align with API: skip localhost REDIS_URL so accidental dev misconfig does not break. */
export function effectiveRedisUrl(): string | undefined {
  const raw = process.env.REDIS_URL?.trim();
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  if (lower.includes("localhost") || lower.includes("127.0.0.1")) {
    return undefined;
  }
  return raw;
}

let client: Redis | null = null;

export function getAnalyticsRedis(): Redis | null {
  const url = effectiveRedisUrl();
  if (!url) return null;
  if (!client) {
    try {
      client = new Redis(url, {
        maxRetriesPerRequest: 2,
        enableOfflineQueue: false,
        lazyConnect: true,
        connectTimeout: 5000
      });
      client.on("error", () => {
        /* avoid crashing Next — analytics stays best-effort */
      });
    } catch {
      client = null;
    }
  }
  return client;
}

/** Redis stream for dashboard funnel events (dual-write with `.analytics/events.ndjson`). */
export const ANALYTICS_EVENTS_STREAM = "pulse:analytics:events";
