import crypto from "crypto";
import { redisConnection } from "../lib/redis";

const ttlSeconds = 600;

type MemoryEntry = { payload: string; expiresAt: number };
const memoryStore = new Map<string, MemoryEntry>();

function sweepExpired() {
  const now = Date.now();
  for (const [k, v] of memoryStore) {
    if (v.expiresAt <= now) memoryStore.delete(k);
  }
}

export async function issueOAuthState(context: Record<string, string>): Promise<string> {
  const state = crypto.randomBytes(32).toString("hex");
  const key = `oauth-state:${state}`;
  const value = JSON.stringify(context);

  if (redisConnection) {
    try {
      await redisConnection.set(key, value, "EX", ttlSeconds);
      return state;
    } catch {
      console.warn("Redis unavailable for OAuth state — using in-memory store (single-instance only).");
    }
  }

  sweepExpired();
  memoryStore.set(key, { payload: value, expiresAt: Date.now() + ttlSeconds * 1000 });
  return state;
}

export async function consumeOAuthState(state: string): Promise<Record<string, string> | null> {
  const key = `oauth-state:${state}`;

  if (redisConnection) {
    try {
      const payload = await redisConnection.get(key);
      if (payload) {
        await redisConnection.del(key);
        return JSON.parse(payload) as Record<string, string>;
      }
    } catch {
      console.warn("Redis get failed for OAuth state — checking memory store.");
    }
  }

  sweepExpired();
  const mem = memoryStore.get(key);
  if (!mem || mem.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  memoryStore.delete(key);
  return JSON.parse(mem.payload) as Record<string, string>;
}
