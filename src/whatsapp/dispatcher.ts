import type { JobsOptions } from "bullmq";
import { Queue } from "bullmq";
import type Redis from "ioredis";
import { env } from "../config/env";
import { queueDefaultJobOptions } from "../lib/bullmqDefaults";
import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { redisConnection } from "../lib/redis";
import { queueNames } from "../queues/queueNames";
import type { PulseNormalisedWhatsAppMessage, WhatsAppIngressQueuePayload } from "../types/pulse-message.types";
import { evaluateWhatsAppWaRateLimit } from "./rate-limiter";
import { normaliseWhatsAppCloudWebhook } from "./normaliser";
import { appendRedisSessionTurn, persistSupabaseSessionHistory } from "./session.store";
import {
  recordWhatsAppDuplicateSkipped,
  recordWhatsAppInbound,
  recordWhatsAppIngressDispatch,
  recordWhatsAppIngressRateLimited
} from "./wa.metrics";

let whatsappIngressQueueInstance: Queue<WhatsAppIngressQueuePayload> | null = null;

function getWhatsAppIngressQueue(): Queue<WhatsAppIngressQueuePayload> | null {
  if (!redisConnection) {
    return null;
  }
  if (!whatsappIngressQueueInstance) {
    whatsappIngressQueueInstance = new Queue(queueNames.whatsappIngress, {
      connection: redisConnection,
      defaultJobOptions: queueDefaultJobOptions
    });
  }
  return whatsappIngressQueueInstance;
}

export function computeWithinCustomerCareWindow(messageTimestampUtcMs: number, nowMs: number = Date.now()): boolean {
  return nowMs - messageTimestampUtcMs <= 24 * 60 * 60 * 1000;
}

/**
 * Redis SET NX on Meta `message.id` — mitigates duplicate webhook deliveries when TTL is positive.
 */
async function claimWhatsAppMessageDelivery(redis: Redis, messageId: string): Promise<boolean> {
  const ttl = env.WA_WEBHOOK_MSG_DEDUPE_TTL_SEC;
  if (ttl <= 0) {
    return true;
  }
  try {
    const key = `pulse:wa:mid:${messageId}`;
    const r = await redis.set(key, "1", "EX", ttl, "NX");
    return r === "OK";
  } catch {
    return true;
  }
}

/** BullMQ custom jobId must not contain `:`. Session ids use `wa:sess:…` — use `-` separators and strip colons from parts. */
function jobIdFor(message: PulseNormalisedWhatsAppMessage): string {
  const mid = message.messageId.replace(/:/g, "-");
  const sid = message.sessionId.replace(/:/g, "-");
  const raw = `wa-${mid}-${sid}`;
  return raw.length <= 128 ? raw : raw.slice(0, 128);
}

export async function enqueueWhatsAppIngressPayload(payload: WhatsAppIngressQueuePayload): Promise<void> {
  const q = getWhatsAppIngressQueue();
  const opts: JobsOptions = {
    jobId: jobIdFor(payload.message),
    removeOnComplete: 50
  };
  if (!q) {
    logger.warn("WhatsApp ingress: Redis unavailable — job not enqueued", {
      waId: payload.waId,
      sessionId: payload.sessionId,
      source: payload.source
    });
    return;
  }
  try {
    await q.add(queueNames.whatsappIngress, payload, opts);
  } catch (err) {
    logger.error("WhatsApp ingress: queue add failed", {
      message: err instanceof Error ? err.message : String(err),
      waId: payload.waId
    });
  }
}

export async function dispatchNormalisedWhatsAppMessage(
  message: PulseNormalisedWhatsAppMessage,
  redis: Redis | null
): Promise<void> {
  if (redis) {
    const claimed = await claimWhatsAppMessageDelivery(redis, message.messageId);
    if (!claimed) {
      recordWhatsAppDuplicateSkipped();
      return;
    }
  }

  if (!redis) {
    recordWhatsAppInbound();
    recordWhatsAppIngressDispatch("no_redis");
    await appendRedisSessionTurn(null, message);
    await persistSupabaseSessionHistory(message);
    const within = computeWithinCustomerCareWindow(message.timestampUtcMs);
    await enqueueWhatsAppIngressPayload({
      source: "whatsapp",
      waId: message.waId,
      sessionId: message.sessionId,
      message,
      withinCustomerCareWindow: within
    });
    return;
  }

  const rate = await evaluateWhatsAppWaRateLimit(message.waId);
  if (!rate.allowed) {
    recordWhatsAppIngressRateLimited();
    return;
  }

  recordWhatsAppInbound();

  const within = computeWithinCustomerCareWindow(message.timestampUtcMs);
  recordWhatsAppIngressDispatch(within ? "queued_in_window" : "queued_outside_care_window");

  await enqueueWhatsAppIngressPayload({
    source: "whatsapp",
    waId: message.waId,
    sessionId: message.sessionId,
    message,
    withinCustomerCareWindow: within
  });
}

export async function dispatchWhatsAppCloudWebhookBody(body: unknown): Promise<void> {
  // Handle delivery/read status updates from Meta
  await handleWhatsAppStatusUpdates(body);

  const messages = normaliseWhatsAppCloudWebhook(body);
  for (const m of messages) {
    try {
      await dispatchNormalisedWhatsAppMessage(m, redisConnection);
    } catch (err) {
      logger.error("whatsapp dispatch message failed", {
        message: err instanceof Error ? err.message : String(err),
        waId: m.waId
      });
    }
  }
}

/**
 * Processes Meta status update webhooks (sent → delivered → read → failed).
 * Updates WhatsAppMessage rows by metaMessageId.
 */
async function handleWhatsAppStatusUpdates(body: unknown): Promise<void> {
  try {
    if (!body || typeof body !== "object") return;
    const root = body as Record<string, unknown>;
    if (root.object !== "whatsapp_business_account") return;
    const entries = Array.isArray(root.entry) ? root.entry : [];
    for (const entry of entries) {
      if (!entry || typeof entry !== "object") continue;
      const changes = (entry as Record<string, unknown>).changes;
      if (!Array.isArray(changes)) continue;
      for (const change of changes) {
        if (!change || typeof change !== "object") continue;
        const c = change as Record<string, unknown>;
        if (c.field !== "messages") continue;
        const value = c.value as Record<string, unknown> | undefined;
        if (!value) continue;
        const statuses = value.statuses;
        if (!Array.isArray(statuses)) continue;
        for (const s of statuses) {
          if (!s || typeof s !== "object") continue;
          const st = s as Record<string, unknown>;
          const metaMessageId = typeof st.id === "string" ? st.id : null;
          const status = typeof st.status === "string" ? st.status : null;
          if (!metaMessageId || !status) continue;
          // Map Meta statuses: sent | delivered | read | failed
          const mapped = ["sent", "delivered", "read", "failed"].includes(status) ? status : null;
          if (!mapped) continue;
          const failureReason =
            mapped === "failed" && st.errors && Array.isArray(st.errors) && st.errors[0]
              ? String((st.errors[0] as Record<string, unknown>).title ?? "unknown")
              : undefined;
          prisma.whatsAppMessage
            .updateMany({
              where: { metaMessageId },
              data: { status: mapped, ...(failureReason ? { failureReason } : {}) }
            })
            .catch((e) =>
              logger.warn("[dispatcher] status update persist failed", {
                message: e instanceof Error ? e.message : String(e),
                metaMessageId
              })
            );
        }
      }
    }
  } catch (err) {
    logger.warn("[dispatcher] status update handling failed", {
      message: err instanceof Error ? err.message : String(err)
    });
  }
}
