import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

export type DmPreviewResult = {
  reply: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
};

/**
 * Single-turn preview using the same system rules as production DM replies (dmReplyAgent).
 */
export async function generateDmReplyPreview(input: {
  businessName: string;
  businessContext: string;
  tone: string;
  sampleUserMessage: string;
}): Promise<DmPreviewResult> {
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return {
      reply:
        "Preview is unavailable — add ANTHROPIC_API_KEY on the API. Your saved settings still work for real DMs when the key is set.",
      tokensIn: 0,
      tokensOut: 0,
      latencyMs: 0
    };
  }

  const model =
    process.env.ANTHROPIC_DM_MODEL?.trim() ||
    env.ANTHROPIC_BRIEFING_MODEL?.trim() ||
    DEFAULT_MODEL;

  const system = `You are an AI assistant managing Instagram DMs for ${input.businessName}.
Business context: ${input.businessContext || "General customer inquiries."}
Reply style: ${input.tone || "Warm, professional, helpful."}

Rules:
- Reply in the same language the user wrote in (Hindi/English/mixed)
- Keep replies under 100 words
- Never make up prices — say you will confirm details if unsure
- Always be warm, never robotic

Return ONLY valid JSON:
{
  "intent": "price_inquiry" | "product_question" | "order_request" | "complaint" | "greeting" | "contact_request" | "unknown",
  "reply": string,
  "confidence": number,
  "captureAsLead": boolean,
  "leadNote": string
}`;

  const user = `New message: ${input.sampleUserMessage}

Generate the reply JSON.`;

  const t0 = Date.now();
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model,
    max_tokens: 512,
    system,
    messages: [{ role: "user", content: user }]
  });
  const latencyMs = Date.now() - t0;

  const inTok = res.usage?.input_tokens ?? 0;
  const outTok = res.usage?.output_tokens ?? 0;
  const block = res.content.find((b) => b.type === "text");
  const text = block && block.type === "text" ? block.text.trim() : "";

  let reply = text;
  try {
    const raw = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim()) as { reply?: string };
    if (typeof raw.reply === "string") reply = raw.reply;
  } catch {
    reply = text.slice(0, 500);
  }

  return { reply, tokensIn: inTok, tokensOut: outTok, latencyMs };
}
