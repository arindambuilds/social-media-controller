import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env";
import { logger } from "../lib/logger";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

export type DmIntent =
  | "price_inquiry"
  | "product_question"
  | "order_request"
  | "complaint"
  | "greeting"
  | "contact_request"
  | "unknown";

export type DmReplyResult = {
  intent: DmIntent;
  reply: string;
  confidence: number;
  captureAsLead: boolean;
  leadNote: string;
};

const VALID_INTENTS = new Set<DmIntent>([
  "price_inquiry",
  "product_question",
  "order_request",
  "complaint",
  "greeting",
  "contact_request",
  "unknown"
]);

function coerceIntent(raw: unknown): DmIntent {
  if (typeof raw === "string" && VALID_INTENTS.has(raw as DmIntent)) {
    return raw as DmIntent;
  }
  return "unknown";
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function extractJsonObject(text: string): string {
  const t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  if (fence?.[1]) return fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) return t.slice(start, end + 1);
  return t;
}

function parseDmReplyJson(text: string): DmReplyResult | null {
  try {
    const raw = JSON.parse(extractJsonObject(text)) as Record<string, unknown>;
    const intent = coerceIntent(raw.intent);
    const reply = typeof raw.reply === "string" ? raw.reply : "";
    const confidence = clamp01(typeof raw.confidence === "number" ? raw.confidence : Number(raw.confidence));
    const captureAsLead = raw.captureAsLead === true;
    const leadNote = typeof raw.leadNote === "string" ? raw.leadNote : "";
    return { intent, reply, confidence, captureAsLead, leadNote };
  } catch {
    return null;
  }
}

const FALLBACK: DmReplyResult = {
  intent: "unknown",
  reply: "",
  confidence: 0,
  captureAsLead: false,
  leadNote: ""
};

export async function generateDmReply(
  incomingMessage: string,
  conversationHistory: string[],
  businessContext: string,
  ownerTone: string,
  businessName: string
): Promise<DmReplyResult> {
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    logger.warn("[dmReplyAgent] ANTHROPIC_API_KEY missing — escalation path");
    return { ...FALLBACK };
  }

  const model =
    process.env.ANTHROPIC_DM_MODEL?.trim() ||
    env.ANTHROPIC_BRIEFING_MODEL?.trim() ||
    DEFAULT_MODEL;

  const system = `You are an AI assistant managing Instagram DMs for ${businessName}.
Business context: ${businessContext || "General customer inquiries."}
Reply style: ${ownerTone || "Warm, professional, helpful."}

Rules:
- Reply in the same language the user wrote in (Hindi/English/mixed)
- Keep replies under 100 words
- Never make up prices — say 'DM ke liye shukriya, ek second mein details bhejte hain' if unsure
- For order requests: collect name and phone number naturally
- Confidence below 0.6 means you're unsure — flag it
- Always be warm, never robotic

Return ONLY valid JSON:
{
  "intent": "price_inquiry" | "product_question" | "order_request" | "complaint" | "greeting" | "contact_request" | "unknown",
  "reply": string,
  "confidence": number,
  "captureAsLead": boolean,
  "leadNote": string
}`;

  const user = `Conversation so far:
${conversationHistory.length ? conversationHistory.join("\n") : "(no prior messages)"}

New message: ${incomingMessage}

Generate the reply JSON.`;

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model,
      max_tokens: 512,
      system,
      messages: [{ role: "user", content: user }]
    });
    const block = res.content.find((b) => b.type === "text");
    const text = block && block.type === "text" ? block.text.trim() : "";
    const parsed = text ? parseDmReplyJson(text) : null;
    return parsed ?? { ...FALLBACK };
  } catch (err) {
    logger.warn("[dmReplyAgent] Claude request failed", {
      message: err instanceof Error ? err.message : String(err)
    });
    return { ...FALLBACK };
  }
}
