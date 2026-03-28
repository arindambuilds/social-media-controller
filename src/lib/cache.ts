import { redisConnection } from "./redis";

const DEFAULT_TTL_SEC = 3600;

export function analyticsOverviewCacheKey(clientId: string, days: number): string {
  return `analytics:overview:v2:${clientId}:${days}`;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redisConnection) return null;
  try {
    const raw = await redisConnection.get(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSec = DEFAULT_TTL_SEC): Promise<void> {
  if (!redisConnection) return;
  try {
    await redisConnection.set(key, JSON.stringify(value), "EX", ttlSec);
  } catch {
    /* Redis optional for MVP — analytics still works without cache */
  }
}

export async function cacheDelByPrefix(prefix: string): Promise<void> {
  if (!redisConnection) return;
  const stream = redisConnection.scanStream({ match: `${prefix}*`, count: 100 });
  const keys: string[] = [];
  for await (const batch of stream) {
    keys.push(...batch);
  }
  if (keys.length) await redisConnection.del(...keys);
}
