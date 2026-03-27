import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { getInstagramAnalyticsSummary } from "./analyticsService";

export async function generateContentPerformanceInsight(clientId: string) {
  const summary = await getInstagramAnalyticsSummary(clientId);

  const deterministicInsights = buildDeterministicInsights(summary);
  const narrative = env.OPENAI_API_KEY
    ? await generateNarrative(summary, deterministicInsights)
    : deterministicInsights.join(" ");

  const insight = await prisma.aiInsight.create({
    data: {
      clientId,
      type: "CONTENT_PERFORMANCE",
      title: "Instagram content performance summary",
      summary: narrative,
      payload: {
        summary,
        deterministicInsights
      }
    }
  });

  return insight;
}

export async function generateCaptions(input: {
  clientId: string;
  niche: string;
  tone: string;
  objective: string;
  offer?: string;
}) {
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

For each caption include:
- caption text
- first-line hook
- CTA
- 5 hashtags`;

  if (!env.OPENAI_API_KEY) {
    return {
      prompt,
      captions: [
        "Glow up your feed with a strong local offer and clear CTA.",
        "Show the result first, then explain the service in simple words.",
        "Use a short hook, one benefit, and a booking CTA.",
        "Make it local, specific, and tied to one customer problem.",
        "Post with social proof and a direct next step."
      ]
    };
  }

  const text = await callOpenAI(prompt, "You write high-converting Instagram captions for local businesses.");
  return {
    prompt,
    captions: text.split("\n\n").filter(Boolean)
  };
}

export async function generateWeeklyRecommendations(clientId: string) {
  const summary = await getInstagramAnalyticsSummary(clientId);
  const rules = buildRuleSignals(summary);
  const text = env.OPENAI_API_KEY
    ? await callOpenAI(
        `Turn these structured Instagram growth signals into 3 practical weekly recommendations:\n${JSON.stringify(rules)}`,
        "You are an Instagram growth strategist for small businesses. Be concise and practical."
      )
    : rules.join(" ");

  const recommendation = await prisma.recommendation.create({
    data: {
      clientId,
      category: "WEEKLY_GROWTH",
      priority: 1,
      text,
      sourceData: {
        summary,
        rules
      }
    }
  });

  return recommendation;
}

function buildDeterministicInsights(summary: Awaited<ReturnType<typeof getInstagramAnalyticsSummary>>) {
  const lines: string[] = [];
  const bestHour = summary.topHours[0];
  const bestCaptionBucket = [...summary.captionPerformance].sort(
    (a, b) => b.avgEngagementRate - a.avgEngagementRate
  )[0];

  if (bestHour) {
    lines.push(`Your strongest posting window is around ${bestHour.hour}:00.`);
  }

  if (bestCaptionBucket) {
    lines.push(`${capitalize(bestCaptionBucket.bucket)} captions currently perform best.`);
  }

  if (summary.averageEngagementRate > 0) {
    lines.push(`Average engagement rate is ${summary.averageEngagementRate.toFixed(2)}.`);
  }

  return lines;
}

function buildRuleSignals(summary: Awaited<ReturnType<typeof getInstagramAnalyticsSummary>>) {
  const signals: string[] = [];
  const bestHour = summary.topHours[0];
  const bestCaptionBucket = [...summary.captionPerformance].sort(
    (a, b) => b.avgEngagementRate - a.avgEngagementRate
  )[0];

  if (bestHour) {
    signals.push(`Schedule more posts around ${bestHour.hour}:00 because that hour performs best.`);
  }

  if (bestCaptionBucket) {
    signals.push(`Lean into ${bestCaptionBucket.bucket} captions because they outperform other formats.`);
  }

  if (summary.worstPosts.length > 0) {
    signals.push("Review your lowest-performing posts and avoid repeating their structure.");
  }

  return signals;
}

async function generateNarrative(
  summary: Awaited<ReturnType<typeof getInstagramAnalyticsSummary>>,
  deterministicInsights: string[]
) {
  return callOpenAI(
    `Analyze this Instagram summary and convert it into a short business-friendly insight report.\nSummary: ${JSON.stringify(summary)}\nBase insights: ${deterministicInsights.join(" ")}`,
    "You are a concise Instagram analyst for local businesses. Use only the provided data."
  );
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

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
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
