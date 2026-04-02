import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { recordAiGeneration } from "./usageService";

export type CaptionCard = {
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
};

function parseCaptionBlob(raw: string, index: number): CaptionCard {
  const hashtags = (raw.match(/#[\w\u00c0-\u024f]+/g) ?? []).slice(0, 12);
  const lines = raw.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const hook = lines[0] ?? `Idea ${index + 1}`;
  const ctaLine =
    lines.find((l) => /book|dm|link|tap|shop|call|visit|order|save/i.test(l)) ?? lines[lines.length - 1] ?? "DM us to book.";
  const bodyLines = lines.filter((l) => l !== hook && l !== ctaLine);
  const body = bodyLines.join("\n").trim() || raw.replace(hook, "").replace(ctaLine, "").trim() || raw;
  return { hook, body, cta: ctaLine, hashtags };
}

function tryParseCaptionJson(text: string): CaptionCard[] | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("[")) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) return null;
    const out: CaptionCard[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const hook = typeof o.hook === "string" ? o.hook : "";
      const body = typeof o.body === "string" ? o.body : "";
      const cta = typeof o.cta === "string" ? o.cta : "";
      const tags = Array.isArray(o.hashtags) ? o.hashtags.filter((t): t is string => typeof t === "string") : [];
      if (hook || body) {
        out.push({
          hook: hook || "Hook",
          body: body || hook,
          cta: cta || "DM us",
          hashtags: tags.map((t) => (t.startsWith("#") ? t : `#${t}`))
        });
      }
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}

export async function generateCaptions(input: {
  clientId: string;
  niche: string;
  tone: string;
  objective: string;
  offer?: string;
}): Promise<{ prompt: string; captions: CaptionCard[] }> {
  const recentPosts = await prisma.post.findMany({
    where: {
      socialAccount: {
        clientId: input.clientId,
        platform: "INSTAGRAM"
      }
    },
    orderBy: {
      publishedAt: "desc"
    },
    take: 5,
    select: {
      content: true
    }
  });

  type RecentPost = {
    content: string | null;
  };

  const prompt = `Write 5 Instagram captions for a ${input.niche} business.
Tone: ${input.tone}
Goal: ${input.objective}
Offer: ${input.offer ?? "none"}
Avoid repeating these previous styles:
${(recentPosts as RecentPost[]).map((post) => post.content ?? "").filter(Boolean).join("\n---\n")}

Return ONLY valid JSON: an array of 5 objects with keys hook (string), body (string), cta (string), hashtags (array of strings starting with #).`;

  if (!env.OPENAI_API_KEY) {
    const stubs = [
      "Your weekend glow-up starts here ✨\nBook the makeover package locals love.\nDM \"GLOW\" to reserve your slot.\n#glowup #localbusiness",
      "Real results, zero fluff.\nSee why clients keep coming back.\nTap the link in bio to book.\n#beforeandafter #salon",
      "Busy schedule? We get it.\nSame-day slots open for trims + color.\nCall or DM to claim yours.\n#hairstylist #booking",
      "Soft light, sharp cut, confident you.\nWalk in stressed, walk out polished.\nBook online — link in bio.\n#selfcare #style",
      "Tag someone who needs this reset 🙌\nNew client offer ends Sunday.\nComment BOOK for details.\n#community #offer"
    ];
    const captions = stubs.map((s, i) => parseCaptionBlob(s, i));
    await recordAiGeneration(input.clientId);
    return { prompt, captions };
  }

  const text = await callOpenAI(
    prompt,
    "You write high-converting Instagram captions for local businesses. Output JSON only."
  );
  const fromJson = tryParseCaptionJson(text);
  if (fromJson) {
    await recordAiGeneration(input.clientId);
    return { prompt, captions: fromJson };
  }
  const chunks = text.split(/\n\n/).filter(Boolean);
  const captions = chunks.slice(0, 5).map((c, i) => parseCaptionBlob(c, i));
  await recordAiGeneration(input.clientId);
  return { prompt, captions };
}

export async function generateWeeklyRecommendations(clientId: string) {
  const text = env.OPENAI_API_KEY
    ? await callOpenAI(
        "Turn these Instagram growth signals into 3 practical weekly recommendations.",
        "You are an Instagram growth strategist for small businesses. Be concise and practical."
      )
    : [
        "This week: schedule 3 posts for 6–9 PM (your demo data peaks in the evening) with one clear DM or booking CTA.",
        "Reuse the hook pattern from your top posts — local context (#Bhubaneswar) plus a specific offer beats generic captions.",
        "Reply to story reactions and comments within 2 hours; treat quick replies as part of conversion, not optional."
      ].join(" ");

  const recommendation = await prisma.recommendation.create({
    data: {
      clientId,
      category: "WEEKLY_GROWTH",
      priority: 1,
      text,
      sourceData: {
        legacy: true
      }
    }
  });

  return recommendation;
}

async function callOpenAI(prompt: string, system: string) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      reasoning: { effort: "low" },
      input: [
        {
          role: "developer",
          content: system
        },
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    const err = payload.error as { message?: string } | undefined;
    throw new Error(err?.message ?? "OpenAI request failed.");
  }

  const text = extractResponseText(payload);
  if (!text) {
    throw new Error("OpenAI response contained no text output.");
  }
  return text;
}

function extractResponseText(payload: Record<string, unknown>) {
  const direct = payload.output_text;
  if (typeof direct === "string" && direct.trim()) {
    return direct;
  }

  const output = payload.output;
  if (!Array.isArray(output)) {
    return "";
  }

  const chunks: string[] = [];

  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const type = (part as { type?: unknown }).type;
      const text = (part as { text?: unknown }).text;
      if (type === "output_text" && typeof text === "string") {
        chunks.push(text);
      }
    }
  }

  return chunks.join("").trim();
}
