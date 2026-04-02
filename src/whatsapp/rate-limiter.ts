import { randomBytes } from "crypto";
import type Redis from "ioredis";
import { redisConnection } from "../lib/redis";

/** Sliding window: max events per `waId` per minute (Redis time scores in ms). */
export const WHATSAPP_WA_RATE_MAX = 30;
export const WHATSAPP_WA_RATE_WINDOW_MS = 60_000;

/**
 * Atomic ZADD + trim + count. Returns 1 if allowed, 0 if over limit (insert rolled back).
 */
export const WHATSAPP_RATE_LIMIT_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local member = ARGV[2]
local window = tonumber(ARGV[3])
local max = tonumber(ARGV[4])
redis.call("ZADD", key, now, member)
redis.call("ZREMRANGEBYSCORE", key, 0, now - window)
local n = redis.call("ZCARD", key)
if n > max then
  redis.call("ZREM", key, member)
  return 0
end
redis.call("EXPIRE", key, math.ceil(window / 1000) + 120)
return 1
`;

function rateLimitKey(waId: string): string {
  return `pulse:wa:rl:${waId}`;
}

/**
 * @returns true if under limit (event counted), false if rate limited.
 */
export async function checkWhatsAppWaRateLimit(redis: Redis, waId: string): Promise<boolean> {
  const now = Date.now();
  const member = `${now}:${randomBytes(8).toString("hex")}`;
  const res = await redis.eval(
    WHATSAPP_RATE_LIMIT_LUA,
    1,
    rateLimitKey(waId),
    String(now),
    member,
    String(WHATSAPP_WA_RATE_WINDOW_MS),
    String(WHATSAPP_WA_RATE_MAX)
  );
  return res === 1;
}

/**
 * Uses shared {@link redisConnection} (mockable in tests). On Redis errors, allows traffic.
 */
export async function evaluateWhatsAppWaRateLimit(waId: string): Promise<{ allowed: boolean; count: number }> {
  const redis = redisConnection;
  if (!redis) {
    return { allowed: true, count: 0 };
  }
  try {
    const now = Date.now();
    const member = `${now}:${randomBytes(8).toString("hex")}`;
    const res = await redis.eval(
      WHATSAPP_RATE_LIMIT_LUA,
      1,
      rateLimitKey(waId),
      String(now),
      member,
      String(WHATSAPP_WA_RATE_WINDOW_MS),
      String(WHATSAPP_WA_RATE_MAX)
    );
    if (res === 0) {
      return { allowed: false, count: 31 };
    }
    return { allowed: true, count: 30 };
  } catch {
    return { allowed: true, count: 0 };
  }
}
