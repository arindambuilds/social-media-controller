import Redis from "ioredis";
import { env } from "../config/env";
import { logger } from "../lib/logger";

const PROCESSED_TTL_SEC = 24 * 60 * 60;
const HISTORY_MAX = 10;
const CONTEXT_LAST = 5;

function processedKey(messageId: string): string {
  return `dm:processed:${messageId}`;
}

function historyKey(clientId: string, igUserId: string): string {
  return `dm:history:${clientId}:${igUserId}`;
}

let redis: Redis | null = null;

function getRedis(): Redis | null {
  const url = env.REDIS_URL?.trim();
  if (!url) return null;
  if (!redis) {
    redis = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true });
    redis.on("error", (err) => {
      logger.warn("[dmDedup] Redis error", { message: err instanceof Error ? err.message : String(err) });
    });
  }
  return redis;
}

type HistoryLine = { role: "user" | "bot"; text: string };

const memoryProcessed = new Map<string, number>();
const memoryHistory = new Map<string, HistoryLine[]>();

function pruneMemoryProcessed(): void {
  const now = Date.now();
  for (const [k, exp] of memoryProcessed) {
    if (exp <= now) memoryProcessed.delete(k);
  }
}

function formatLine(role: "user" | "bot", message: string): string {
  return role === "user" ? `User: ${message}` : `Bot: ${message}`;
}

export async function isProcessed(messageId: string): Promise<boolean> {
  const r = getRedis();
  if (r) {
    try {
      const v = await r.get(processedKey(messageId));
      return v !== null;
    } catch {
      /* fall through */
    }
  }
  pruneMemoryProcessed();
  const exp = memoryProcessed.get(messageId);
  return exp !== undefined && exp > Date.now();
}

export async function markProcessed(messageId: string): Promise<void> {
  const r = getRedis();
  if (r) {
    try {
      await r.set(processedKey(messageId), "1", "EX", PROCESSED_TTL_SEC);
      return;
    } catch {
      /* fall through */
    }
  }
  memoryProcessed.set(messageId, Date.now() + PROCESSED_TTL_SEC * 1000);
}

export async function getConversationHistory(igUserId: string, clientId: string): Promise<string[]> {
  const r = getRedis();
  if (r) {
    try {
      const key = historyKey(clientId, igUserId);
      const len = await r.llen(key);
      if (len === 0) return [];
      const start = Math.max(0, len - CONTEXT_LAST);
      const raw = await r.lrange(key, start, -1);
      return raw.map((line) => {
        try {
          const o = JSON.parse(line) as HistoryLine;
          if (o && (o.role === "user" || o.role === "bot") && typeof o.text === "string") {
            return formatLine(o.role, o.text);
          }
        } catch {
          /* ignore */
        }
        return line;
      });
    } catch {
      /* fall through */
    }
  }
  const list = memoryHistory.get(historyKey(clientId, igUserId)) ?? [];
  return list.slice(-CONTEXT_LAST).map((h) => formatLine(h.role, h.text));
}

export async function addToHistory(
  igUserId: string,
  clientId: string,
  role: "user" | "bot",
  message: string
): Promise<void> {
  const key = historyKey(clientId, igUserId);
  const payload = JSON.stringify({ role, text: message } satisfies HistoryLine);
  const r = getRedis();
  if (r) {
    try {
      await r.rpush(key, payload);
      await r.ltrim(key, -HISTORY_MAX, -1);
      await r.expire(key, PROCESSED_TTL_SEC);
      return;
    } catch {
      /* fall through */
    }
  }
  const list = memoryHistory.get(key) ?? [];
  list.push({ role, text: message });
  while (list.length > HISTORY_MAX) list.shift();
  memoryHistory.set(key, list);
}
