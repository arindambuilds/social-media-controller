import Anthropic from "@anthropic-ai/sdk";
import type { PulseTier } from "../config/pulseTiers";
import { BriefingGenerationError, isOdiaBriefingLanguage, morningBriefing } from "../lib/claudeClient";
import { logger } from "../lib/logger";
import type { BriefingData } from "./briefingData";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

function todayIndiaLongDate(): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(new Date());
}

function buildFallbackBriefing(data: BriefingData, tier: PulseTier): string {
  const top = data.topPost
    ? `Your best post reached about ${data.topPost.reach} people with ${data.topPost.likes} likes — bahut achha momentum.`
    : "We are still collecting yesterday's post reach — keep posting consistently.";
  if (tier === "free" || tier === "normal") {
    return (
      `Namaskar, ${data.ownerName}! ${todayIndiaLongDate()}: ${data.newFollowers} new followers, ` +
      `${data.newLeads} leads, ${data.likesYesterday} likes, ${data.commentsYesterday} comments. ` +
      `${top} ${data.scheduledToday} posts scheduled today — one clear post + quick DM replies will compound.`
    );
  }
  const trend =
    data.leadsLast7d != null && data.leadsPrev7d != null
      ? ` Last 7 days: ${data.leadsLast7d} leads vs ${data.leadsPrev7d} the week before.`
      : "";
  const next =
    tier === "elite"
      ? " Priority today: reply to newest leads first, then ship the scheduled post on time."
      : " Suggested focus: one extra story or reel if you are below your usual rhythm.";
  return (
    `Namaskar, ${data.ownerName}! Pulse check-in for ${todayIndiaLongDate()}. ` +
    `${data.businessName}: ${data.newFollowers} followers gained yesterday, ${data.newLeads} leads, ` +
    `${data.likesYesterday} likes.${trend} ${top}${next}`
  );
}

/** Deterministic Odia fallback when Claude is unavailable (Odia-first clients). */
export function buildOdiaFallbackBriefing(data: BriefingData, tier: PulseTier): string {
  const top = data.topPost
    ? `ଗତକାଲିର ଶ୍ରେଷ୍ଠ ପୋଷ୍ଟ ପ୍ରାୟ ${data.topPost.reach} ଲୋକଙ୍କ ପାଖରେ ପହଞ୍ଚିଛି, ${data.topPost.likes} ଲାଇକ୍—ଭଲ ଗତି।`
    : "ଗତକାଲିର ପୋଷ୍ଟ ମିଟ୍ରିକ୍ ଏପର୍ଯ୍ୟନ୍ତ ପୂର୍ଣ୍ଣ ନୁହେଁ—ନିୟମିତ ପୋଷ୍ଟ ଜାରି ରଖନ୍ତୁ।";
  if (tier === "free" || tier === "normal") {
    return (
      `ନମସ୍କାର ${data.ownerName}! ${todayIndiaLongDate()}: ନୂଆ ଫଲୋୟାର ${data.newFollowers}, ` +
      `ଲିଡ୍ ${data.newLeads}, ଲାଇକ୍ ${data.likesYesterday}, ମନ୍ତବ୍ୟ ${data.commentsYesterday}. ` +
      `${top} ଆଜି ${data.scheduledToday} ପୋଷ୍ଟ ସିଡ୍ୟୁଲ୍—ଗୋଟିଏ ସ୍ପଷ୍ଟ ପୋଷ୍ଟ ଓ ଦ୍ରୁତ ଡିଏମ୍ ଉତ୍ତର ଦିଅନ୍ତୁ।`
    );
  }
  const trend =
    data.leadsLast7d != null && data.leadsPrev7d != null
      ? ` ଗତ ୭ ଦିନରେ ଲିଡ୍ ${data.leadsLast7d} (ପୂର୍ବ ୭ ଦିନ: ${data.leadsPrev7d})।`
      : "";
  return (
    `ନମସ୍କାର ${data.ownerName}! ${data.businessName} ପାଇଁ ${todayIndiaLongDate()} ର ସକାଳୀନ ଚେକ୍: ` +
    `ଗତକାଲି ${data.newFollowers} ନୂଆ ଫଲୋୟାର, ${data.newLeads} ଲିଡ୍, ${data.likesYesterday} ଲାଇକ୍।${trend} ${top} ` +
    `ଆଜି ନୂଆ ଲିଡ୍‌କୁ ପ୍ରାଥମିକତା ଦିଅନ୍ତୁ ଏବଂ ସିଡ୍ୟୁଲ୍ ପୋଷ୍ଟ ସମୟରେ ପୋଷ୍ଟ କରନ୍ତୁ।`
  );
}

/** Shown in WhatsApp/email when Claude is unavailable or errors. */
export const CLAUDE_TIP_FALLBACK =
  "Keep posting consistently today! Check your dashboard for latest analytics.";

export type BriefingGenerationResult = {
  content: string;
  /** False when API key missing, empty model response, or Claude request threw. */
  claudeSucceeded: boolean;
};

function tierPromptRules(tier: PulseTier): string {
  if (tier === "free" || tier === "normal") {
    return (
      "Tier: Normal — keep it skimmable on WhatsApp in under ~30 seconds.\n" +
      "- Under 85 words, one short paragraph.\n" +
      "- Cover yesterday only: followers gained, leads, likes, comments, best post if present.\n" +
      "- One practical nudge for today (no section headers, no bullet lists).\n" +
      "- Do NOT invent week-over-week or funnel analysis."
    );
  }
  if (tier === "standard") {
    return (
      "Tier: Standard — business owner in Odisha, decision-oriented.\n" +
      "- Under 115 words, max two short paragraphs.\n" +
      "- Include yesterday’s numbers plus a simple week context using leadsLast7d vs leadsPrev7d when both are present.\n" +
      "- End with one concrete suggestion for today.\n" +
      "- No markdown, no bullets."
    );
  }
  return (
    "Tier: Elite — operator-style clarity.\n" +
    "- Under 150 words, max two paragraphs.\n" +
    "- Yesterday’s numbers, 7-day lead trend if present, follower net 7d if present.\n" +
    "- Explicit “What to do next”: prioritise newest leads, timing, or content fix — pick one sharp line.\n" +
    "- If avgLikesPrior7d is present and likesYesterday is materially lower, acknowledge gently (no panic).\n" +
    "- Plain text only, warm tone, 1–2 Hindi words max."
  );
}

export type GenerateBriefingOptions = {
  tier?: PulseTier;
  /** When `or` or `odia`, uses `morningBriefing` (pure Odia Claude path). */
  clientLanguage?: string | null;
};

/**
 * Generates a warm, short briefing via Claude, or a deterministic fallback if the API is unavailable.
 */
export async function generateBriefing(
  data: BriefingData,
  options?: GenerateBriefingOptions
): Promise<BriefingGenerationResult> {
  const tier = options?.tier ?? "free";
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const topLine = data.topPost
    ? `Best post yesterday: reach ${data.topPost.reach}, likes ${data.topPost.likes}. Caption snippet: ${data.topPost.caption.slice(0, 120)}`
    : "No post metrics for yesterday yet.";

  const userPayload = {
    businessName: data.businessName,
    ownerFirstName: data.ownerName,
    dateIndia: todayIndiaLongDate(),
    tier,
    newFollowers: data.newFollowers,
    totalFollowers: data.totalFollowers,
    newLeads: data.newLeads,
    likesYesterday: data.likesYesterday,
    commentsYesterday: data.commentsYesterday,
    leadsLast7d: data.leadsLast7d ?? null,
    leadsPrev7d: data.leadsPrev7d ?? null,
    followersNet7d: data.followersNet7d ?? null,
    avgLikesPrior7d: data.avgLikesPrior7d ?? null,
    topPostSummary: topLine,
    scheduledToday: data.scheduledToday
  };

  if (isOdiaBriefingLanguage(options?.clientLanguage)) {
    if (!apiKey) {
      logger.warn("[briefingAgent] ANTHROPIC_API_KEY missing — Odia fallback briefing");
      return { content: buildOdiaFallbackBriefing(data, tier), claudeSucceeded: false };
    }
    try {
      const text = await morningBriefing(userPayload, "odia");
      return { content: text, claudeSucceeded: true };
    } catch (err) {
      logger.warn("[briefingAgent] Odia morningBriefing failed", {
        message: err instanceof BriefingGenerationError ? err.message : String(err)
      });
      return { content: buildOdiaFallbackBriefing(data, tier), claudeSucceeded: false };
    }
  }

  if (!apiKey) {
    logger.warn("[briefingAgent] ANTHROPIC_API_KEY missing — using fallback briefing");
    return { content: buildFallbackBriefing(data, tier), claudeSucceeded: false };
  }

  const model = process.env.ANTHROPIC_BRIEFING_MODEL?.trim() || DEFAULT_MODEL;
  const rules = tierPromptRules(tier);
  const maxTok = tier === "elite" ? 640 : tier === "standard" ? 560 : 400;

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model,
      max_tokens: maxTok,
      messages: [
        {
          role: "user",
          content:
            `Write the morning briefing using this JSON (facts are authoritative):\n${JSON.stringify(userPayload)}\n\n${rules}\n- Start with "Namaskar!" and address ${data.ownerName} by first name.\n- Mention dateIndia naturally.\n- Use 1–2 Hindi words where natural (bahut achha, shabash, sundar).\n- Plain text only.`
        }
      ]
    });

    const block = res.content.find((b) => b.type === "text");
    const text = block && block.type === "text" ? block.text.trim() : "";
    if (!text) {
      return { content: buildFallbackBriefing(data, tier), claudeSucceeded: false };
    }
    return { content: text, claudeSucceeded: true };
  } catch (err) {
    logger.warn("[briefingAgent] Claude request failed", {
      message: err instanceof Error ? err.message : String(err)
    });
    return { content: buildFallbackBriefing(data, tier), claudeSucceeded: false };
  }
}
