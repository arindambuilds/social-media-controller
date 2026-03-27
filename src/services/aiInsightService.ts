import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { recordAiGeneration } from "./usageService";

type EngagementStats = {
  likes?: number;
  commentsCount?: number;
  shares?: number;
  saves?: number;
  reach?: number;
  impressions?: number;
  engagementRate?: number | null;
};

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getEngagement(stats: EngagementStats) {
  const likes = asNumber(stats.likes);
  const comments = asNumber(stats.commentsCount);
  const shares = asNumber(stats.shares);
  const saves = asNumber(stats.saves);
  const reach = asNumber(stats.reach);
  const engagement = likes + comments + shares + saves;
  const engagementRate =
    typeof stats.engagementRate === "number" && Number.isFinite(stats.engagementRate)
      ? stats.engagementRate
      : reach > 0
        ? engagement / reach
        : 0;
  return { likes, comments, shares, saves, reach, engagement, engagementRate };
}

export async function generateInsight(clientId: string, platform: string) {
  const posts = await prisma.post.findMany({
    where: {
      socialAccount: {
        clientId,
        platform: platform as never
      },
      publishedAt: { lte: new Date() }
    },
    orderBy: { publishedAt: "desc" },
    take: 30
  });

  const rows = posts.map((p) => {
    const stats = (p.engagementStats ?? {}) as EngagementStats;
    const e = getEngagement(stats);
    return {
      id: p.id,
      publishedAt: p.publishedAt.toISOString(),
      hour: p.publishedAt.getHours(),
      captionLength: (p.content ?? "").length,
      ...e
    };
  });

  const deterministic = buildDeterministicNarrative(rows);

  let summary = deterministic.summary;
  let recommendations = deterministic.recommendations;

  const llm = await tryChatCompletion({
    platform,
    rows,
    deterministic
  });

  if (llm) {
    summary = llm.summary;
    recommendations = llm.recommendations;
  }

  const keyInsights = buildKeyInsightBullets(summary, rows.length);
  const warning =
    rows.length < 3
      ? "Limited post history — treat these signals as directional, not definitive."
      : null;

  const saved = await prisma.aiInsight.create({
    data: {
      clientId,
      platform,
      summary,
      recommendations,
      keyInsights,
      warning
    }
  });

  await recordAiGeneration(clientId);

  return saved;
}

function buildKeyInsightBullets(summary: string, postCount: number): string[] {
  const sentences = summary
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);
  if (sentences.length >= 2) {
    return sentences.slice(0, 4);
  }
  return [
    postCount > 0
      ? `Based on ${postCount} recent posts.`
      : "Not enough synced posts to benchmark performance yet.",
    summary.slice(0, 220)
  ];
}

function buildDeterministicNarrative(
  rows: Array<{
    hour: number;
    captionLength: number;
    engagementRate: number;
    likes: number;
    comments: number;
  }>
) {
  const byHour = new Map<number, number[]>();
  const byCaptionBucket = new Map<"short" | "medium" | "long", number[]>();

  for (const r of rows) {
    byHour.set(r.hour, [...(byHour.get(r.hour) ?? []), r.engagementRate]);
    const bucket = r.captionLength < 80 ? "short" : r.captionLength < 180 ? "medium" : "long";
    byCaptionBucket.set(bucket, [...(byCaptionBucket.get(bucket) ?? []), r.engagementRate]);
  }

  const topHour = [...byHour.entries()]
    .map(([hour, values]) => ({ hour, avg: avg(values) }))
    .sort((a, b) => b.avg - a.avg)[0];

  const captionWinner = [...byCaptionBucket.entries()]
    .map(([bucket, values]) => ({ bucket, avg: avg(values) }))
    .sort((a, b) => b.avg - a.avg)[0];

  const avgEng = avg(rows.map((r) => r.engagementRate));
  const avgLikes = avg(rows.map((r) => r.likes));
  const avgComments = avg(rows.map((r) => r.comments));

  const recommendations: string[] = [];
  if (topHour) {
    recommendations.push(`Post more content around ${topHour.hour}:00 (your strongest hour).`);
  }
  if (captionWinner) {
    recommendations.push(`Lean into ${captionWinner.bucket} captions — they perform best in this sample.`);
  }
  recommendations.push("Reuse the structure of your top 3 posts (hook → value → CTA).");

  const summary = [
    `Based on your last ${rows.length} posts, average engagement rate is ${(avgEng * 100).toFixed(1)}%.`,
    topHour ? `Posts around ${topHour.hour}:00 perform best.` : "Not enough data to find a best hour.",
    captionWinner
      ? `${capitalize(captionWinner.bucket)} captions perform best right now.`
      : "Not enough data to compare caption lengths.",
    `Typical post gets ~${avgLikes.toFixed(0)} likes and ~${avgComments.toFixed(0)} comments.`
  ].join(" ");

  return { summary, recommendations };
}

async function tryChatCompletion(input: {
  platform: string;
  rows: unknown;
  deterministic: { summary: string; recommendations: string[] };
}): Promise<{ summary: string; recommendations: string[] } | null> {
  if (!env.OPENAI_API_KEY) return null;

  try {
    const prompt = {
      platform: input.platform,
      guidance: "Return concise, practical growth insights. Use only provided data.",
      data: input.rows,
      baseline: input.deterministic
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "You are an Instagram performance analyst for small businesses in India. Use only the provided data. Output JSON only with keys: summary (string), recommendations (string[])."
          },
          { role: "user", content: JSON.stringify(prompt) }
        ]
      })
    });

    const payload = (await response.json().catch(() => ({}))) as any;
    const content: unknown = payload?.choices?.[0]?.message?.content;
    if (!response.ok || typeof content !== "string") {
      return null;
    }

    const parsed = JSON.parse(content) as { summary?: unknown; recommendations?: unknown };
    if (typeof parsed.summary !== "string" || !Array.isArray(parsed.recommendations)) {
      return null;
    }
    const recommendations = parsed.recommendations.filter((x): x is string => typeof x === "string");
    return { summary: parsed.summary, recommendations };
  } catch {
    return null;
  }
}

function avg(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export const CONTENT_INSIGHT_COOLDOWN_SEC = 300;

function recommendationsAsStringArray(value: unknown): string[] {
  if (Array.isArray(value) && value.every((x) => typeof x === "string")) {
    return value as string[];
  }
  return [];
}

function keyInsightsAsStringArray(value: unknown, summary: string): string[] {
  if (Array.isArray(value) && value.every((x) => typeof x === "string")) {
    return value as string[];
  }
  return buildKeyInsightBullets(summary, 0);
}

export function cooldownRemainingSeconds(generatedAt: Date): number {
  const elapsed = (Date.now() - generatedAt.getTime()) / 1000;
  return Math.max(0, Math.ceil(CONTENT_INSIGHT_COOLDOWN_SEC - elapsed));
}

export async function getLatestContentInsightPayload(clientId: string) {
  const row = await prisma.aiInsight.findFirst({
    where: { clientId, platform: "INSTAGRAM" },
    orderBy: { generatedAt: "desc" }
  });

  if (!row) {
    return { insight: null as null, cooldownRemainingSeconds: 0 };
  }

  const actions = recommendationsAsStringArray(row.recommendations).slice(0, 3);
  const keys = keyInsightsAsStringArray(row.keyInsights, row.summary).slice(0, 3);

  return {
    insight: {
      id: row.id,
      keyInsights: keys,
      actionsThisWeek: actions,
      warning: row.warning,
      userFeedback: row.userFeedback,
      generatedAt: row.generatedAt.toISOString()
    },
    cooldownRemainingSeconds: cooldownRemainingSeconds(row.generatedAt)
  };
}

export async function applyInsightFeedback(insightId: string, clientId: string, vote: "up" | "down") {
  const value = vote === "up" ? 1 : -1;
  const result = await prisma.aiInsight.updateMany({
    where: { id: insightId, clientId },
    data: { userFeedback: value }
  });
  return result.count > 0;
}

