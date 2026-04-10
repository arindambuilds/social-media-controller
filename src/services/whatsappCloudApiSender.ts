import { env } from "../config/env";
import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { redisConnection } from "../lib/redis";
import type { WhatsAppOutboundJobPayload } from "../queues/whatsappOutboundQueue";
import { getLastInboundTs } from "../whatsapp/session.store";
import {
  recordWhatsApp24hViolation,
  recordWhatsAppOutboundFailed,
  recordWhatsAppOutboundSent
} from "../whatsapp/wa.metrics";

const PAUSED_KEY = (waId: string) => `pulse:wa:contact_paused:${waId}`;

export type SendWhatsAppMessageResult =
  | { status: "sent"; messageId?: string }
  | { status: "24h_window_expired" }
  | { status: "template_required" }
  | { status: "recipient_unreachable" }
  | { status: "skipped_paused" };

/** Retryable — BullMQ should backoff (Meta throughput / 130429). */
export class WhatsAppMetaRateLimitError extends Error {
  override readonly name = "WhatsAppMetaRateLimitError";
  constructor(message = "WA_META_RATE_LIMIT") {
    super(message);
  }
}

function buildGraphBody(
  waId: string,
  messageType: "freeform" | "template",
  payload: Record<string, unknown>
): Record<string, unknown> {
  if (payload.messaging_product === "whatsapp" && typeof payload.to === "string") {
    return { ...payload } as Record<string, unknown>;
  }
  if (messageType === "template") {
    const template = (payload.template as Record<string, unknown>) ?? payload;
    return {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: waId,
      type: "template",
      template
    };
  }
  const text =
    typeof payload.body === "string"
      ? payload.body
      : typeof payload.text === "string"
        ? payload.text
        : "";
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: waId,
    type: "text",
    text: { body: text, preview_url: Boolean(payload.preview_url) }
  };
}

/**
 * Meta WhatsApp Cloud API outbound send (Graph v19). Twilio path remains in {@link ./whatsappSender}.
 */
export async function sendWhatsAppMessage(
  job: WhatsAppOutboundJobPayload,
  fetchImpl: typeof fetch = fetch
): Promise<SendWhatsAppMessageResult> {
  const { waId, messageType, payload, contextId } = job;

  if (redisConnection) {
    const paused = await redisConnection.get(PAUSED_KEY(waId));
    if (paused === "1") {
      recordWhatsAppOutboundFailed(waId);
      return { status: "skipped_paused" };
    }
  }

  const lastMs = await getLastInboundTs(redisConnection, waId);
  const now = Date.now();
  const outside = lastMs == null || (now - lastMs) / 1000 > 86400;

  if (messageType === "freeform" && outside) {
    recordWhatsApp24hViolation(waId);
    return { status: "24h_window_expired" };
  }

  const phoneId = env.WA_PHONE_NUMBER_ID.trim();
  const token = env.WA_GRAPH_ACCESS_TOKEN;
  if (!phoneId || !token) {
    throw new Error("WA_PHONE_NUMBER_ID or WhatsApp Graph token (WA_ACCESS_TOKEN / WA_TOKEN) missing");
  }

  const graphBody = buildGraphBody(waId, messageType, payload);
  if (contextId) {
    graphBody.context = { message_id: contextId };
  }

  const apiVersion = env.WA_API_VERSION.replace(/^\/+/, "").trim() || "v19.0";
  const url = `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(phoneId)}/messages`;
  logger.info("[whatsappCloudApiSender] Graph send attempt", {
    waId,
    messageType,
    hasContext: Boolean(contextId)
  });
  const res = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(graphBody)
  });

  const data = (await res.json()) as {
    error?: { code?: number; message?: string };
    messages?: { id?: string }[];
  };

  if (!res.ok) {
    const code = data.error?.code;
    // 130429 — throughput rate limit (retryable)
    if (code === 130429) {
      throw new WhatsAppMetaRateLimitError();
    }
    // 131047 — message outside 24h window, template required
    if (code === 131047) {
      recordWhatsApp24hViolation(waId);
      recordWhatsAppOutboundFailed(waId, code);
      return { status: "template_required" };
    }
    // 131026 — recipient phone not on WhatsApp
    if (code === 131026) {
      if (redisConnection) {
        await redisConnection.set(PAUSED_KEY(waId), "1", "EX", 30 * 86400).catch(() => {
          /* best-effort */
        });
      }
      recordWhatsAppOutboundFailed(waId, code);
      return { status: "recipient_unreachable" };
    }
    // 131048 — spam rate limit (account-level, retryable after backoff)
    if (code === 131048) {
      throw new WhatsAppMetaRateLimitError("WA_SPAM_RATE_LIMIT_131048");
    }
    // 131056 — pair rate limit (too many messages to same recipient)
    if (code === 131056) {
      throw new WhatsAppMetaRateLimitError("WA_PAIR_RATE_LIMIT_131056");
    }
    // 100 — invalid parameter (unrecoverable)
    if (code === 100) {
      logger.error("[whatsappCloudApiSender] invalid parameter (100)", { waId, detail: data.error?.message });
      recordWhatsAppOutboundFailed(waId, code);
      throw new Error(`WA_INVALID_PARAM: ${data.error?.message ?? "invalid parameter"}`);
    }
    recordWhatsAppOutboundFailed(waId, code);
    throw new Error(data.error?.message ?? `graph_http_${res.status}`);
  }

  const mid = data.messages?.[0]?.id;
  recordWhatsAppOutboundSent(waId);
  logger.info("[whatsappCloudApiSender] Graph send ok", { waId, messageId: mid });

  // Persist outbound message status for delivery tracking
  if (mid) {
    const textBody =
      typeof job.payload.body === "string"
        ? job.payload.body
        : typeof job.payload.text === "string"
          ? job.payload.text
          : undefined;
    prisma.whatsAppMessage
      .create({
        data: {
          clientId: job.clientId ?? waId,
          waId,
          metaMessageId: mid,
          direction: "outbound",
          content: textBody,
          messageType: job.messageType,
          status: "sent",
          withinWindow: !outside
        }
      })
      .catch((e) =>
        logger.warn("[whatsappCloudApiSender] status persist failed", {
          message: e instanceof Error ? e.message : String(e)
        })
      );
  }

  return { status: "sent", messageId: mid };
}
