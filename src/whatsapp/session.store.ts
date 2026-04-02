import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type Redis from "ioredis";
import { redisConnection } from "../lib/redis";
import { logger } from "../lib/logger";
import type { PulseNormalisedWhatsAppMessage, PulseWhatsAppSessionTurn } from "../types/pulse-message.types";

const TURN_LIST_MAX = 10;
const SESSION_TTL_SEC = 24 * 60 * 60;

function redisTurnsKey(sessionId: string): string {
  return `pulse:wa:turns:${sessionId}`;
}

function lastInboundKey(waId: string): string {
  return `pulse:wa:last_inbound:${waId}`;
}

/**
 * Latest user message timestamp (ms) for customer-care window hints — TTL 48h.
 * Updated whenever {@link appendRedisSessionTurn} runs with Redis.
 */
export async function recordInbound(redis: Redis | null, waId: string, timestampUtcMs: number): Promise<void> {
  if (!redis) {
    return;
  }
  try {
    await redis.set(lastInboundKey(waId), String(timestampUtcMs), "EX", 48 * 60 * 60);
  } catch (err) {
    logger.warn("whatsapp session: recordInbound failed", {
      message: err instanceof Error ? err.message : String(err),
      waId
    });
  }
}

export async function getLastInboundTs(redis: Redis | null, waId: string): Promise<number | null> {
  if (!redis) {
    return null;
  }
  try {
    const raw = await redis.get(lastInboundKey(waId));
    if (!raw) {
      return null;
    }
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch (err) {
    logger.warn("whatsapp session: getLastInboundTs failed", {
      message: err instanceof Error ? err.message : String(err),
      waId
    });
    return null;
  }
}

let supabaseCached: SupabaseClient | null = null;
let supabaseInitAttempted = false;

function getSupabase(): SupabaseClient | null {
  if (supabaseInitAttempted) {
    return supabaseCached;
  }
  supabaseInitAttempted = true;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    return null;
  }
  try {
    supabaseCached = createClient(url, key, { auth: { persistSession: false } });
  } catch (err) {
    logger.warn("whatsapp session: Supabase client init failed", {
      message: err instanceof Error ? err.message : String(err)
    });
    supabaseCached = null;
  }
  return supabaseCached;
}

function turnFromMessage(message: PulseNormalisedWhatsAppMessage): PulseWhatsAppSessionTurn {
  const base: PulseWhatsAppSessionTurn = {
    role: "user",
    waId: message.waId,
    sessionId: message.sessionId,
    messageId: message.messageId,
    timestampUtcMs: message.timestampUtcMs
  };
  if (message.payload.kind === "text") {
    return { ...base, text: message.payload.body };
  }
  if (message.payload.kind === "unknown") {
    return { ...base, text: "", mediaKind: "unknown" };
  }
  return {
    ...base,
    mediaId: message.payload.mediaId,
    mediaKind: message.payload.kind,
    text: message.payload.caption
  };
}

/**
 * Keeps last {@link TURN_LIST_MAX} user turns in Redis (LPUSH + LTRIM), TTL 24h.
 */
export async function appendRedisSessionTurn(redis: Redis | null, message: PulseNormalisedWhatsAppMessage): Promise<void> {
  if (!redis) {
    return;
  }
  const turn = turnFromMessage(message);
  const key = redisTurnsKey(message.sessionId);
  const payload = JSON.stringify(turn);
  try {
    const pipeline = redis.multi();
    pipeline.lpush(key, payload);
    pipeline.ltrim(key, 0, TURN_LIST_MAX - 1);
    pipeline.expire(key, SESSION_TTL_SEC);
    await pipeline.exec();
    await recordInbound(redis, message.waId, message.timestampUtcMs);
  } catch (err) {
    logger.warn("whatsapp session: redis append failed", {
      message: err instanceof Error ? err.message : String(err),
      sessionId: message.sessionId
    });
  }
}

/**
 * Persists full history row to Supabase (`pulse_whatsapp_turns` table — create in Supabase SQL if needed).
 */
/**
 * Session + cold storage update for ingress worker (append turn, refresh last-inbound TTL).
 */
export async function updateSessionFromNormalisedMessage(
  redis: Redis | null,
  message: PulseNormalisedWhatsAppMessage
): Promise<void> {
  await appendRedisSessionTurn(redis, message);
  await persistSupabaseSessionHistory(message);
}

/**
 * Up to three prior user turns (excludes the newest LPUSH entry) as short strings for reply context.
 */
export async function getSessionContext(waId: string): Promise<string[]> {
  if (!redisConnection) {
    return [];
  }
  const sessionId = `wa:sess:${waId}`;
  const key = redisTurnsKey(sessionId);
  try {
    const raw = await redisConnection.lrange(key, 1, 3);
    const lines: string[] = [];
    for (const item of raw) {
      try {
        const t = JSON.parse(item) as PulseWhatsAppSessionTurn;
        const bit = t.text?.trim() || (t.mediaId ? `[${t.mediaKind ?? "media"}]` : "");
        if (bit.length) {
          lines.push(bit);
        }
      } catch {
        /* skip malformed */
      }
    }
    return lines.reverse();
  } catch (err) {
    logger.warn("whatsapp session: getSessionContext failed", {
      message: err instanceof Error ? err.message : String(err),
      waId
    });
    return [];
  }
}

export async function persistSupabaseSessionHistory(message: PulseNormalisedWhatsAppMessage): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    return;
  }
  const turn = turnFromMessage(message);
  try {
    const { error } = await sb.from("pulse_whatsapp_turns").insert({
      session_id: turn.sessionId,
      wa_id: turn.waId,
      message_id: turn.messageId,
      payload: turn,
      created_at: new Date(turn.timestampUtcMs).toISOString()
    });
    if (error) {
      logger.warn("whatsapp session: Supabase insert skipped or failed", {
        message: error.message,
        code: error.code
      });
    }
  } catch (err) {
    logger.warn("whatsapp session: Supabase insert threw", {
      message: err instanceof Error ? err.message : String(err)
    });
  }
}

/**
 * After media upload, patch the newest matching turn in Redis with a public object URL.
 */
export async function patchRedisTurnMediaUrl(
  redis: Redis | null,
  sessionId: string,
  messageId: string,
  mediaStorageUrl: string
): Promise<void> {
  if (!redis) {
    return;
  }
  const key = redisTurnsKey(sessionId);
  try {
    const raw = await redis.lrange(key, 0, TURN_LIST_MAX - 1);
    if (!raw.length) {
      return;
    }
    const updated: string[] = [];
    for (const item of raw) {
      try {
        const parsed = JSON.parse(item) as PulseWhatsAppSessionTurn;
        if (parsed.messageId === messageId) {
          parsed.mediaStorageUrl = mediaStorageUrl;
        }
        updated.push(JSON.stringify(parsed));
      } catch (parseErr) {
        logger.debug("whatsapp session: skip malformed turn JSON in media patch", {
          message: parseErr instanceof Error ? parseErr.message : String(parseErr)
        });
        updated.push(item);
      }
    }
    if (updated.length) {
      const pipe = redis.multi();
      pipe.del(key);
      for (let i = updated.length - 1; i >= 0; i -= 1) {
        pipe.lpush(key, updated[i]);
      }
      pipe.expire(key, SESSION_TTL_SEC);
      await pipe.exec();
    }
  } catch (err) {
    logger.warn("whatsapp session: redis media patch failed", {
      message: err instanceof Error ? err.message : String(err),
      sessionId
    });
  }
}
