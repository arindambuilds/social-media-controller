import IORedis from "ioredis";
import { env } from "../config/env";

const url = (env.REDIS_URL ?? "").trim();

/** True when a non-empty REDIS_URL is configured (queues, cache, OAuth state in Redis). */
export const redisEnabled = Boolean(url);

/**
 * Shared client when Redis is configured. Lazy connect + no offline queue so a bad URL
 * does not block process startup. BullMQ requires `maxRetriesPerRequest: null` on this client.
 */
export const redisConnection: IORedis | null = redisEnabled
  ? new IORedis(url, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      enableOfflineQueue: false
    })
  : null;

if (redisConnection) {
  redisConnection.on("error", (err) => {
    console.warn("Redis connection error:", err.message);
  });
}
