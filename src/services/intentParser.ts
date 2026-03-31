import Anthropic from "@anthropic-ai/sdk";

export type VoicePlatform = "instagram" | "facebook" | "both";

export type VoiceIntent = {
  topic: string;
  platform: VoicePlatform;
  scheduledTime: string;
  tone: "festive" | "promotional" | "informational" | "casual";
  language: "hindi" | "english" | "bilingual";
  rawTranscript: string;
};

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

function istNowIsoContext(): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date());
}

function extractJson(text: string): string {
  const t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t);
  if (fence) return fence[1]!.trim();
  return t;
}

function defaultIntent(transcript: string): VoiceIntent {
  return {
    topic: transcript.slice(0, 80) || "your update",
    platform: "instagram",
    scheduledTime: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
    tone: "casual",
    language: /[\u0900-\u097F]/.test(transcript) ? "bilingual" : "english",
    rawTranscript: transcript
  };
}

/**
 * Parse owner voice command into structured intent (JSON from Claude).
 */
export async function parseVoiceIntent(transcript: string): Promise<VoiceIntent> {
  const trimmed = transcript.trim();
  if (!trimmed) {
    return defaultIntent("");
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return defaultIntent(trimmed);
  }

  const model = process.env.ANTHROPIC_VOICE_MODEL?.trim() || DEFAULT_MODEL;
  const system = `You are an intent parser for an Indian MSME social media tool.
Extract structured data from voice commands. Always return valid JSON only, no markdown, no explanation.
Keys: topic (string), platform ("instagram" | "facebook" | "both"), scheduledTime (ISO 8601 datetime string in UTC),
tone ("festive" | "promotional" | "informational" | "casual"), language ("hindi" | "english" | "bilingual").
Convert relative times (e.g. "kal sham", "tonight 7pm", "tomorrow morning") to concrete ISO datetimes using the provided current time in India.
Default platform to "instagram" if not specified. Default language to "bilingual" if Hindi words appear in the transcript.`;

  const user = `Current time (India reference): ${istNowIsoContext()}
Transcript: ${trimmed}

Return one JSON object with keys: topic, platform, scheduledTime, tone, language.`;

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model,
      max_tokens: 512,
      system,
      messages: [{ role: "user", content: user }]
    });
    const block = res.content.find((b) => b.type === "text");
    const rawText = block && block.type === "text" ? block.text : "";
    const jsonStr = extractJson(rawText);
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

    const platformRaw = String(parsed.platform ?? "instagram").toLowerCase();
    const platform: VoicePlatform =
      platformRaw === "facebook" ? "facebook" : platformRaw === "both" ? "both" : "instagram";

    const toneRaw = String(parsed.tone ?? "casual").toLowerCase();
    const tone: VoiceIntent["tone"] =
      toneRaw === "festive"
        ? "festive"
        : toneRaw === "promotional"
          ? "promotional"
          : toneRaw === "informational"
            ? "informational"
            : "casual";

    const langRaw = String(parsed.language ?? "bilingual").toLowerCase();
    const language: VoiceIntent["language"] =
      langRaw === "hindi" ? "hindi" : langRaw === "english" ? "english" : "bilingual";

    let scheduledTime = String(parsed.scheduledTime ?? "");
    const t = Date.parse(scheduledTime);
    if (Number.isNaN(t)) {
      scheduledTime = new Date(Date.now() + 3 * 3600 * 1000).toISOString();
    }

    return {
      topic: String(parsed.topic ?? trimmed.slice(0, 120)).slice(0, 200),
      platform,
      scheduledTime,
      tone,
      language,
      rawTranscript: trimmed
    };
  } catch (err) {
    console.warn("[intentParser] parse failed, using defaults", {
      message: err instanceof Error ? err.message : String(err)
    });
    return defaultIntent(trimmed);
  }
}
