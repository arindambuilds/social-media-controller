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
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
      connectTimeout: 5000
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
