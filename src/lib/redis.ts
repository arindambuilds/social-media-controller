import Redis from "ioredis";

function effectiveRedisUrl(): string | undefined {
  const raw = process.env.REDIS_URL?.trim();
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  if (lower.includes("localhost") || lower.includes("127.0.0.1")) {
    console.warn(
      "REDIS_URL points to localhost — treating Redis as unavailable (set a real Redis URL or unset REDIS_URL)"
    );
    return undefined;
  }
  return raw;
}

let redisClient: Redis | null = null;
const url = effectiveRedisUrl();

if (url) {
  try {
    /** BullMQ blocking commands require null — avoids stalled workers / odd timeouts. */
    redisClient = new Redis(url, {
      maxRetriesPerRequest: null,
      /** When Redis drops briefly, queue commands buffer instead of throwing "Stream isn't writable". */
      enableOfflineQueue: true,
      lazyConnect: true,
      connectTimeout: 5000,
      keepAlive: 10_000
    });
    redisClient.on("error", (err) => {
      console.warn("Redis error:", err.message);
    });
  } catch (err) {
    console.warn("Redis init failed:", err);
    redisClient = null;
  }
} else {
  console.warn("No REDIS_URL - running without Redis");
}

/** @deprecated Prefer `redisConnection` — default export for compatibility. */
export default redisClient;

export const redisConnection = redisClient;
export const redisEnabled = Boolean(redisClient);

/**
 * BullMQ needs isolated connections (pub/sub + blocking). Fixed count per process — not per request.
 */
export function createBullMqConnection(): Redis | null {
  if (!redisClient) return null;
  return redisClient.duplicate({
    maxRetriesPerRequest: null,
    enableOfflineQueue: true,
    lazyConnect: true,
    connectTimeout: 5000,
    keepAlive: 10_000
  });
}
