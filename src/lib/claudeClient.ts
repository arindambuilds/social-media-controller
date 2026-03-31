import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { prisma } from "./prisma";
import { getBriefingData } from "../services/briefingData";

const BILINGUAL_BRIEFING_JSON_SCHEMA = z.object({
  en: z.string().min(1),
  or: z.string().min(1)
});

export type BilingualBriefing = z.infer<typeof BILINGUAL_BRIEFING_JSON_SCHEMA>;

export class BriefingGenerationError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "BriefingGenerationError";
  }
}

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

/** Prisma `Client.language`: `or` is Odia; `odia` accepted as alias. */
export function isOdiaBriefingLanguage(lang: string | null | undefined): boolean {
  const l = (lang ?? "").trim().toLowerCase();
  return l === "or" || l === "odia";
}

const ODIA_MORNING_BRIEFING_FEW_SHOTS = `
Few-shot examples (match this structure and tone in Odia script; use the Data JSON for all numbers — do not copy sample figures):

1) ନମସ୍କାର ସୁନୀତା! ଆଜି ଆପଣଙ୍କ ବ୍ୟବସାୟରେ ଗତକାଲି ୧୨ ନୂଆ ଫଲୋୟାର ମିଳିଛି ଏବଂ ୪ ଲିଡ୍ ଆସିଛି। ଲାଇକ୍ ୪୫ ଏବଂ ମନ୍ତବ୍ୟ ୮। ଲିଡ୍‌ମାନଙ୍କୁ ଶୀଘ୍ର ଉତ୍ତର ଦେଲେ ବିକ୍ରି ବଢିବ। ଆଜି ଗୋଟିଏ ଭଲ ପୋଷ୍ଟ ଯୋଜନା କରନ୍ତୁ—ଆଗକୁ ଆହୁରି ଭଲ ହେବ।

2) ସୁପ୍ରଭାତ ଅଜୟ! ମିଟ୍ରିକ୍: ଫଲୋୟାର ବୃଦ୍ଧି, ଲିଡ୍ ବୃଦ୍ଧି, ଲାଇକ୍ ସ୍ଥିର। ଗତ ସପ୍ତାହ ତୁଳନାରେ ଲିଡ୍ ବଢ଼ିଛି—ଏହା ଭଲ ଚେଷ୍ଟା। ଆଜି ପୁରୁଣା ଲିଡ୍‌କୁ ଫୋଲୋ ଅପ୍ କରନ୍ତୁ। ଆପଣ ସଫଳ ହେବେ।

3) ନମସ୍କାର! ଗତକାଲିର ଆକର୍ଷଣ: ନୂଆ ଫଲୋୟାର ଏବଂ ମନ୍ତବ୍ୟ—ଆଲୋଚନା ଜିବନ୍ତ ଅଛି। ଆଜିର ପରାମର୍ଶ: ସମୟ ମତ ପୋଷ୍ଟ କରନ୍ତୁ ଏବଂ ଡିଏମ୍ ରିପ୍ଲାଏ ଦିଅନ୍ତୁ। ଶୁଭ ସକାଳ!
`;

/**
 * Odia-first morning briefing (WhatsApp / BullMQ path). Call only when `isOdiaBriefingLanguage(language)`.
 * Returns plain Odia text only when Claude succeeds.
 */
export async function morningBriefing(
  data: Record<string, unknown>,
  language: string
): Promise<string> {
  const lang = language.trim().toLowerCase();
  if (lang !== "odia" && lang !== "or") {
    throw new BriefingGenerationError('morningBriefing requires language "odia" or "or"');
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new BriefingGenerationError("ANTHROPIC_API_KEY is not configured");
  }

  const model = process.env.ANTHROPIC_BRIEFING_MODEL?.trim() || DEFAULT_MODEL;
  const userPrompt =
    `You are an expert business analyst for MSME owners in Odisha. The client has chosen Odia (language = "odia").\n\n` +
    `Generate the ENTIRE briefing in natural, professional Odia script only. Use simple, clear Odia that a busy business owner understands. Structure: Greeting → Key metrics → Leads/sales highlights → Actionable insights → Encouraging close. Tone: Trusted morning advisor.\n\n` +
    `Data: ${JSON.stringify(data)}\n` +
    `Output ONLY the Odia text. No English, no explanations.\n` +
    ODIA_MORNING_BRIEFING_FEW_SHOTS;

  try {
    const anthropic = new Anthropic({ apiKey });
    const res = await anthropic.messages.create({
      model,
      max_tokens: 900,
      messages: [{ role: "user", content: userPrompt }]
    });
    const block = res.content.find((b) => b.type === "text");
    const text = block && block.type === "text" ? block.text.trim() : "";
    if (!text) {
      throw new BriefingGenerationError("Empty model response");
    }
    return text;
  } catch (e) {
    if (e instanceof BriefingGenerationError) throw e;
    throw new BriefingGenerationError(
      e instanceof Error ? e.message : "Claude request failed",
      e
    );
  }
}

/**
 * Generates a bilingual (English + Odia) JSON briefing via Claude.
 * `language` selects prompt emphasis; both `en` and `or` are always returned when successful.
 */
export async function generateBriefing(clientId: string, language: string): Promise<BilingualBriefing> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, language: true }
  });
  if (!client) {
    throw new BriefingGenerationError("Client not found");
  }

  const data = await getBriefingData(clientId, { expandedMetrics: true });
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new BriefingGenerationError("ANTHROPIC_API_KEY is not configured");
  }

  const model = process.env.ANTHROPIC_BRIEFING_MODEL?.trim() || DEFAULT_MODEL;
  const odiaBlock =
    language === "or" || client.language === "or"
      ? "The `or` field MUST contain genuine Odia script (Unicode U+0B00–U+0B7F), not romanization. Keep it natural for Odisha MSME owners."
      : "Still provide a faithful Odia translation in `or` using Odia script; `en` is primary for this client.";

  const userBlock = {
    businessName: data.businessName,
    newFollowers: data.newFollowers,
    newLeads: data.newLeads,
    likesYesterday: data.likesYesterday,
    commentsYesterday: data.commentsYesterday,
    scheduledToday: data.scheduledToday,
    leadsLast7d: data.leadsLast7d ?? null,
    leadsPrev7d: data.leadsPrev7d ?? null
  };

  try {
    const anthropic = new Anthropic({ apiKey });
    const res = await anthropic.messages.create({
      model,
      max_tokens: 900,
      messages: [
        {
          role: "user",
          content:
            `Return ONLY a single JSON object with keys "en" and "or" (no markdown fence).\n` +
            `Facts (authoritative): ${JSON.stringify(userBlock)}\n\n` +
            `Rules:\n` +
            `- "en": concise morning briefing paragraph for WhatsApp, warm tone, under 120 words.\n` +
            `- "or": same meaning in Odia script, similar length.\n` +
            `- ${odiaBlock}\n` +
            `- Do not include keys other than en and or.`
        }
      ]
    });

    const block = res.content.find((b) => b.type === "text");
    const text = block && block.type === "text" ? block.text.trim() : "";
    if (!text) {
      throw new BriefingGenerationError("Empty model response");
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : text;
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(jsonStr) as unknown;
    } catch (e) {
      throw new BriefingGenerationError("Model returned non-JSON text", e);
    }

    const parsed = BILINGUAL_BRIEFING_JSON_SCHEMA.safeParse(parsedJson);
    if (!parsed.success) {
      throw new BriefingGenerationError(`Invalid briefing JSON: ${parsed.error.message}`);
    }
    return parsed.data;
  } catch (e) {
    if (e instanceof BriefingGenerationError) throw e;
    throw new BriefingGenerationError(
      e instanceof Error ? e.message : "Claude request failed",
      e
    );
  }
}
