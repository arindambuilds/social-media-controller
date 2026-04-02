import { logger } from "../lib/logger";
import { redisConnection } from "../lib/redis";
import { whatsappOutboundQueue } from "../queues/whatsappOutboundQueue";
import type { PulseMessage } from "../types/pulse-message.types";
import { generateWhatsAppReply } from "./whatsappReplyAgent";
import { getLastInboundTs } from "./session.store";

/**
 * Generates a reply, enforces the 24h customer-care window, enqueues Meta outbound send. Never throws.
 */
export async function dispatchAgentReply(message: PulseMessage, sessionContext: string[]): Promise<void> {
  try {
    const lastMs = await getLastInboundTs(redisConnection, message.waId);
    if (lastMs == null) {
      logger.warn("wa_reply_window_expired", {
        waId: message.waId,
        reason: "no_last_inbound"
      });
      return;
    }

    const ageSec = (Date.now() - lastMs) / 1000;
    if (ageSec > 86400) {
      logger.warn("wa_reply_window_expired", { waId: message.waId, ageSec });
      return;
    }

    const reply = await generateWhatsAppReply(message, sessionContext);
    if (reply == null || !reply.trim()) {
      logger.warn("wa_reply_generation_failed", { waId: message.waId, messageId: message.messageId });
      return;
    }

    if (!whatsappOutboundQueue) {
      logger.warn("wa_reply_queue_unavailable", { waId: message.waId });
      return;
    }

    try {
      await whatsappOutboundQueue.add("reply", {
        waId: message.waId,
        messageType: "freeform",
        payload: { body: reply.trim() },
        clientId: message.waId,
        correlationId: message.messageId,
        source: "agent",
        contextId: message.messageId
      });
    } catch (queueErr) {
      logger.warn("wa_reply_enqueue_failed", {
        waId: message.waId,
        message: queueErr instanceof Error ? queueErr.message : String(queueErr)
      });
      return;
    }

    logger.info("wa_reply_enqueued", { waId: message.waId, messageId: message.messageId });
  } catch (err) {
    logger.warn("wa_reply_dispatch_error", {
      message: err instanceof Error ? err.message : String(err),
      waId: message.waId
    });
  }
}
