import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import type { PulseMessage } from "../types/pulse-message.types";

const WHATSAPP_REPLY_MODEL = "claude-sonnet-4-20250514";
const SYSTEM_PROMPT =
  "You are a helpful WhatsApp assistant for an Indian small business. Reply in 1-3 short sentences. Be friendly and professional.";

/**
 * Best-effort Claude reply for a single inbound text turn. Never throws.
 */
export async function generateWhatsAppReply(
  message: PulseMessage,
  sessionContext: string[]
): Promise<string | null> {
  try {
    const apiKey = env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      return null;
    }

    if (message.payload.kind !== "text") {
      return null;
    }

    const lastThree = sessionContext.slice(-3);
    const parts: string[] = [];
    if (lastThree.length > 0) {
      parts.push(
        "Recent customer messages (oldest first):\n" + lastThree.map((t, i) => `${i + 1}. ${t}`).join("\n")
      );
    }
    parts.push(`Latest message:\n${message.payload.body}`);

    const userContent = parts.join("\n\n");

    const anthropic = new Anthropic({ apiKey });
    const res = await anthropic.messages.create({
      model: WHATSAPP_REPLY_MODEL,
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }]
    });

    const block = res.content.find((b) => b.type === "text");
    const text = block && block.type === "text" ? block.text.trim() : "";
    if (!text.length) {
      return null;
    }
    return text;
  } catch (err) {
    logger.debug("whatsappReplyAgent: generation failed", {
      message: err instanceof Error ? err.message : String(err),
      waId: message.waId
    });
    return null;
  }
}
