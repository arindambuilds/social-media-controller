import Anthropic from "@anthropic-ai/sdk";
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

function buildFallbackBriefing(data: BriefingData): string {
  const top = data.topPost
    ? `Your best post reached about ${data.topPost.reach} people with ${data.topPost.likes} likes — bahut achha momentum.`
    : "We are still collecting yesterday's post reach — keep posting consistently.";
  return (
    `Namaskar, ${data.ownerName}! Here is your Pulse check-in for ${todayIndiaLongDate()}. ` +
    `${data.businessName} picked up ${data.newFollowers} new followers yesterday ` +
    `(now around ${data.totalFollowers} total), and ${data.newLeads} new leads came in — shabash. ` +
    `${top} ` +
    `You have ${data.scheduledToday} posts lined up for today — sundar planning. ` +
    `Go make it a great day.`
  );
}

/**
 * Generates a warm, short briefing via Claude, or a deterministic fallback if the API is unavailable.
 */
export async function generateBriefing(data: BriefingData): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    console.log("[briefingAgent] ANTHROPIC_API_KEY missing — using fallback briefing");
    return buildFallbackBriefing(data);
  }

  const model = process.env.ANTHROPIC_BRIEFING_MODEL?.trim() || DEFAULT_MODEL;
  const topLine = data.topPost
    ? `Best post yesterday: reach ${data.topPost.reach}, likes ${data.topPost.likes}. Caption snippet: ${data.topPost.caption.slice(0, 120)}`
    : "No post metrics for yesterday yet.";

  const userPayload = {
    businessName: data.businessName,
    ownerFirstName: data.ownerName,
    dateIndia: todayIndiaLongDate(),
    newFollowers: data.newFollowers,
    totalFollowers: data.totalFollowers,
    newLeads: data.newLeads,
    topPostSummary: topLine,
    scheduledToday: data.scheduledToday
  };

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model,
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `Write the morning briefing using this JSON (facts are authoritative):\n${JSON.stringify(userPayload)}\n\nRules:\n- Start with "Namaskar!" and address ${data.ownerName} by first name.\n- Mention today's date in Indian English format already in dateIndia.\n- Weave in the numbers naturally (followers gained, leads, best post reach/likes if present).\n- Use 1–2 Hindi words naturally (e.g. bahut achha, shabash, sundar).\n- End encouraging them about today's scheduled posts (${data.scheduledToday}).\n- Under 120 words, one or two short paragraphs max, no bullets, no headers, warm friend tone—not corporate.\n- Plain text only.`
        }
      ]
    });

    const block = res.content.find((b) => b.type === "text");
    const text = block && block.type === "text" ? block.text.trim() : "";
    if (!text) {
      return buildFallbackBriefing(data);
    }
    return text;
  } catch (err) {
    console.warn("[briefingAgent] Claude request failed", {
      message: err instanceof Error ? err.message : String(err)
    });
    return buildFallbackBriefing(data);
  }
}
