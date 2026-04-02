import Anthropic from "@anthropic-ai/sdk";
import type { VoiceIntent } from "./intentParser";
import { logger } from "../lib/logger";

export type CaptionResult = {
  caption: string;
  hashtags: string[];
  imagePrompt: string;
  suggestedTime: Date;
};

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

function extractJson(text: string): string {
  const t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t);
  if (fence) return fence[1]!.trim();
  return t;
}

function fallbackCaption(intent: VoiceIntent, businessName: string): CaptionResult {
  const base = `Namaskar! ${businessName} — ${intent.topic}. Jaldi milte hain! DM for details 🙏✨`;
  const tags = [
    "#smallbusiness",
    "#india",
    "#shoplocal",
    "#handmade",
    "#supportlocal",
    "#fashion",
    "#festive",
    "#instagood",
    "#business",
    "#madeinindia"
  ];
  const st = new Date(intent.scheduledTime);
  return {
    caption: base.slice(0, 220),
    hashtags: tags,
    imagePrompt: `Bright product photo for ${intent.topic}, Indian MSME aesthetic, natural light`,
    suggestedTime: Number.isNaN(st.getTime()) ? new Date(Date.now() + 3 * 3600 * 1000) : st
  };
}

/**
 * Generate bilingual caption, hashtags, image prompt, and suggested slot from parsed intent.
 */
export async function generateCaption(intent: VoiceIntent, businessName: string): Promise<CaptionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return fallbackCaption(intent, businessName);
  }

  const model = process.env.ANTHROPIC_VOICE_MODEL?.trim() || DEFAULT_MODEL;
  const system = `You write social captions for Indian small businesses. Reply with valid JSON only.
Keys: caption (string, 150-220 characters, Instagram-friendly), hashtags (array of 10-15 strings, each starting with #),
imagePrompt (string, visual brief for a matching product photo), suggestedTime (ISO 8601 UTC string).
Style rules:
- Sound like a real Indian MSME owner — warm, authentic, not corporate.
- If language is bilingual: mix short Hindi phrases inside English naturally.
- Match tone: festive = celebration; promotional = soft CTA (DM, link in bio); informational = helpful; casual = friendly.
- End caption with 2-3 relevant emojis.
- Hashtags: mix broad (#india #fashion) and niche (#bhubaneswarfashion style when relevant).
- suggestedTime: infer best slot (festive/sale often evening; informational morning) but stay near intent.scheduledTime when sensible.`;

  const user = JSON.stringify({
    businessName,
    intent,
    note: "Use intent.scheduledTime as the primary scheduling anchor; adjust suggestedTime within a few hours if tone suggests a better slot."
  });

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model,
      max_tokens: 800,
      system,
      messages: [{ role: "user", content: user }]
    });
    const block = res.content.find((b) => b.type === "text");
    const rawText = block && block.type === "text" ? block.text : "";
    const parsed = JSON.parse(extractJson(rawText)) as Record<string, unknown>;

    const caption = String(parsed.caption ?? "").trim();
    const tags = Array.isArray(parsed.hashtags)
      ? (parsed.hashtags as unknown[]).map((t) => String(t).trim()).filter(Boolean)
      : [];
    const imagePrompt = String(parsed.imagePrompt ?? "").trim() || `Photo for ${intent.topic}`;
    const stRaw = String(parsed.suggestedTime ?? intent.scheduledTime);
    let suggestedTime = new Date(stRaw);
    if (Number.isNaN(suggestedTime.getTime())) {
      suggestedTime = new Date(intent.scheduledTime);
    }
    if (Number.isNaN(suggestedTime.getTime())) {
      suggestedTime = new Date(Date.now() + 3 * 3600 * 1000);
    }

    if (!caption || caption.length < 40) {
      return fallbackCaption(intent, businessName);
    }

    const normalizedTags = tags
      .map((h) => (h.startsWith("#") ? h : `#${h}`))
      .slice(0, 18);

    return {
      caption: caption.slice(0, 2200),
      hashtags: normalizedTags.length ? normalizedTags : fallbackCaption(intent, businessName).hashtags,
      imagePrompt,
      suggestedTime
    };
  } catch (err) {
    logger.warn("[captionGenerator] failed, using fallback", {
      message: err instanceof Error ? err.message : String(err)
    });
    return fallbackCaption(intent, businessName);
  }
}
