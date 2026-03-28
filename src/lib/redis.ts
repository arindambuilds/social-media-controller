import IORedis from "ioredis";
import { env } from "../config/env";

let redisClient: IORedis | null = null;

try {
  const url = typeof env.REDIS_URL === "string" ? env.REDIS_URL.trim() : "";
  if (url) {
    redisClient = new IORedis(url, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      enableOfflineQueue: false
    });
    redisClient.on("error", (err) => {
      console.warn("Redis connection error:", err.message);
    });
  }
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.warn("Redis unavailable - running without cache:", msg);
  redisClient = null;
}

/** @deprecated Prefer named import `redisConnection` — default export for compatibility. */
export default redisClient;

export const redisConnection = redisClient;
export const redisEnabled = Boolean(redisClient);
