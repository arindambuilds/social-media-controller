import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

const ANALYTICS_PLATFORM = "INSTAGRAM";

type EngagementStats = {
  likes?: number;
  comments?: number;
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
  const comments = asNumber(stats.comments ?? stats.commentsCount);
  const shares = asNumber(stats.shares);
  const saves = asNumber(stats.saves);
  const reach = asNumber(stats.reach);
  return { likes, comments, shares, saves, reach };
}

export async function getPlatformSummary(clientId: string, platform: string) {
  const normalizedPlatform = platform.toUpperCase();

  const posts = await prisma.post.findMany({
    where: {
      socialAccount: {
        clientId,
        platform: normalizedPlatform as never
      },
      // No Post.status field in current schema; include all published dates.
      publishedAt: { lte: new Date() }
    },
    orderBy: { publishedAt: "desc" }
  });

  const parsed = posts.map((p) => {
    const stats = (p.engagementStats ?? {}) as EngagementStats;
    const e = getEngagement(stats);
    return {
      post: p,
      hour: p.publishedAt.getHours(),
      likes: e.likes,
      comments: e.comments,
      shares: e.shares
    };
  });

  const postsAnalyzed = parsed.filter((x) => x.likes || x.comments || x.shares).length;

  // topHours: ranked by average likes per hour
  const buckets = new Map<number, number[]>();
  for (const p of parsed) {
    if (!buckets.has(p.hour)) buckets.set(p.hour, []);
    buckets.get(p.hour)!.push(p.likes);
  }
  const topHours = [...buckets.entries()]
    .map(([hour, values]) => ({
      hour,
      avg: values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0
    }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 3)
    .map((x) => x.hour);

  const avgLikes =
    parsed.length > 0 ? parsed.reduce((s, p) => s + p.likes, 0) / parsed.length : 0;
  const avgComments =
    parsed.length > 0 ? parsed.reduce((s, p) => s + p.comments, 0) / parsed.length : 0;
  const avgShares =
    parsed.length > 0 ? parsed.reduce((s, p) => s + p.shares, 0) / parsed.length : 0;

  // Top/worst posts by likes, take 3
  const byLikes = [...parsed].sort((a, b) => b.likes - a.likes);
  const topPosts = byLikes.slice(0, 3).map((x) => x.post);
  const worstPosts = byLikes.slice(-3).reverse().map((x) => x.post);
  const bestPostingHour = topHours[0] ?? null;
  const captionWinner = topPosts[0]?.content ?? topPosts[0]?.platformPostId ?? "";
  const averageEngagementRate =
    postsAnalyzed > 0
      ? (parsed.reduce((sum, p) => sum + p.likes + p.comments + p.shares, 0) / postsAnalyzed)
      : 0;

  return {
    postsAnalyzed,
    averageEngagementRate,
    bestPostingHour,
    captionWinner,
    topHours,
    captionPerformance: {
      avgLikes,
      avgComments,
      avgShares
    },
    topPosts,
    worstPosts
  };
}

function postWhereClient(clientId: string, days?: number): Prisma.PostWhereInput {
  const since =
    days !== undefined ? new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000) : undefined;
  return {
    socialAccount: {
      clientId,
      platform: ANALYTICS_PLATFORM as never
    },
    ...(since ? { publishedAt: { gte: since } } : { publishedAt: { lte: new Date() } })
  };
}

function engagementRate(stats: EngagementStats, likes: number, comments: number, shares: number): number {
  const reach = asNumber(stats.reach);
  if (reach > 0) {
    return (likes + comments + shares) / reach;
  }
  const impressions = asNumber(stats.impressions);
  if (impressions > 0) {
    return (likes + comments + shares) / impressions;
  }
  if (typeof stats.engagementRate === "number" && Number.isFinite(stats.engagementRate)) {
    return stats.engagementRate;
  }
  return 0;
}

function inferMediaType(mediaUrl: string | null | undefined): string {
  if (!mediaUrl) return "Other";
  if (/\.(mp4|webm|mov)(\?|$)/i.test(mediaUrl)) return "Video";
  return "Photo";
}

export async function getClientOverview(clientId: string, days: number) {
  const posts = await prisma.post.findMany({
    where: postWhereClient(clientId, days),
    orderBy: { publishedAt: "desc" }
  });

  let totalReach = 0;
  const rates: number[] = [];
  const byHour = new Map<number, number[]>();

  for (const p of posts) {
    const stats = (p.engagementStats ?? {}) as EngagementStats;
    const e = getEngagement(stats);
    const er = engagementRate(stats, e.likes, e.comments, e.shares);
    rates.push(er);
    totalReach += asNumber(stats.reach);
    const hour = p.publishedAt.getHours();
    if (!byHour.has(hour)) byHour.set(hour, []);
    byHour.get(hour)!.push(er);
  }

  let bestHour: number | null = null;
  let bestAvg = -1;
  for (const [hour, vals] of byHour) {
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    if (avg > bestAvg) {
      bestAvg = avg;
      bestHour = hour;
    }
  }

  const avgEngagementRate = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;

  return {
    totalPosts: posts.length,
    avgEngagementRate,
    totalReach,
    bestHour
  };
}

export async function getClientPosts(
  clientId: string,
  limit: number,
  sort: "engagement" | "recent"
) {
  const posts = await prisma.post.findMany({
    where: postWhereClient(clientId),
    orderBy: { publishedAt: "desc" },
    take: Math.min(Math.max(limit, 1), 100)
  });

  const mapped = posts.map((p) => {
    const stats = (p.engagementStats ?? {}) as EngagementStats;
    const e = getEngagement(stats);
    const er = engagementRate(stats, e.likes, e.comments, e.shares);
    return {
      id: p.id,
      mediaUrl: p.mediaUrl,
      captionPreview: (p.content ?? "").slice(0, 200),
      engagementRate: er,
      reach: asNumber(stats.reach),
      publishedAt: p.publishedAt.toISOString()
    };
  });

  if (sort === "engagement") {
    mapped.sort((a, b) => b.engagementRate - a.engagementRate);
  }

  return mapped.slice(0, limit);
}

export async function getHourlyInsights(clientId: string) {
  const posts = await prisma.post.findMany({
    where: postWhereClient(clientId),
    select: { publishedAt: true, engagementStats: true }
  });

  const buckets = new Map<number, { rates: number[]; count: number }>();
  for (const p of posts) {
    const h = p.publishedAt.getHours();
    const stats = (p.engagementStats ?? {}) as EngagementStats;
    const e = getEngagement(stats);
    const er = engagementRate(stats, e.likes, e.comments, e.shares);
    if (!buckets.has(h)) buckets.set(h, { rates: [], count: 0 });
    const b = buckets.get(h)!;
    b.rates.push(er);
    b.count += 1;
  }

  const hours = Array.from({ length: 24 }, (_, hour) => {
    const b = buckets.get(hour);
    const avgEngagementRate = b?.rates.length
      ? b.rates.reduce((x, y) => x + y, 0) / b.rates.length
      : 0;
    return {
      hour,
      postCount: b?.count ?? 0,
      avgEngagementRate
    };
  });

  return { hours };
}

export async function getMediaTypeInsights(clientId: string) {
  const posts = await prisma.post.findMany({
    where: postWhereClient(clientId),
    select: { mediaUrl: true, engagementStats: true }
  });

  const buckets = new Map<string, { rates: number[]; count: number }>();
  for (const p of posts) {
    const label = inferMediaType(p.mediaUrl);
    const stats = (p.engagementStats ?? {}) as EngagementStats;
    const e = getEngagement(stats);
    const er = engagementRate(stats, e.likes, e.comments, e.shares);
    if (!buckets.has(label)) buckets.set(label, { rates: [], count: 0 });
    const b = buckets.get(label)!;
    b.rates.push(er);
    b.count += 1;
  }

  return {
    types: [...buckets.entries()].map(([mediaType, b]) => ({
      mediaType,
      postCount: b.count,
      avgEngagementRate: b.rates.length ? b.rates.reduce((x, y) => x + y, 0) / b.rates.length : 0
    }))
  };
}

export async function getEngagementTimeSeries(clientId: string, days: number) {
  const posts = await prisma.post.findMany({
    where: postWhereClient(clientId, days),
    select: { publishedAt: true, engagementStats: true },
    orderBy: { publishedAt: "asc" }
  });

  const byDay = new Map<string, number[]>();
  for (const p of posts) {
    const key = p.publishedAt.toISOString().slice(0, 10);
    const stats = (p.engagementStats ?? {}) as EngagementStats;
    const e = getEngagement(stats);
    const er = engagementRate(stats, e.likes, e.comments, e.shares);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(er);
  }

  const points = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, rates]) => ({
      date,
      engagementRate: rates.length ? rates.reduce((x, y) => x + y, 0) / rates.length : 0
    }));

  return { points };
}

/** Daily follower counts from `FollowerDaily` (seed / sync). Degrades if migration not applied. */
export async function getFollowerGrowth(clientId: string, days: number) {
  try {
    const since = new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000);
    const accounts = await prisma.socialAccount.findMany({
      where: { clientId, platform: ANALYTICS_PLATFORM as never },
      select: { id: true }
    });
    if (!accounts.length) {
      return { points: [] as Array<{ date: string; followerCount: number }> };
    }
    const ids = accounts.map((a) => a.id);
    const rows = await prisma.followerDaily.findMany({
      where: { socialAccountId: { in: ids }, date: { gte: since } },
      orderBy: { date: "asc" }
    });
    const byDate = new Map<string, number>();
    for (const r of rows) {
      const k = r.date.toISOString().slice(0, 10);
      byDate.set(k, (byDate.get(k) ?? 0) + r.followerCount);
    }
    const points = [...byDate.entries()]
      .map(([date, followerCount]) => ({ date, followerCount }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return { points };
  } catch {
    return { points: [] as Array<{ date: string; followerCount: number }> };
  }
}

export async function getInstagramAudienceForClient(clientId: string) {
  try {
    return await prisma.socialAccount.findFirst({
      where: { clientId, platform: ANALYTICS_PLATFORM as never },
      select: { followerCount: true, platformUsername: true, lastSyncedAt: true }
    });
  } catch {
    const acc = await prisma.socialAccount.findFirst({
      where: { clientId, platform: ANALYTICS_PLATFORM as never },
      select: { platformUsername: true, lastSyncedAt: true }
    });
    return acc ? { followerCount: null as number | null, platformUsername: acc.platformUsername, lastSyncedAt: acc.lastSyncedAt } : null;
  }
}
