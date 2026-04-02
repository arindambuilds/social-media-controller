import { OutboundPostStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

export type BriefingData = {
  businessName: string;
  ownerName: string;
  newFollowers: number;
  totalFollowers: number;
  newLeads: number;
  /** Sum of likes on posts for yesterday (IST). */
  likesYesterday: number;
  /** Sum of comments on posts for yesterday (IST). */
  commentsYesterday: number;
  topPost: { caption: string; reach: number; likes: number } | null;
  scheduledToday: number;
  /** Standard / Elite: leads in rolling 7 IST days ending yesterday. */
  leadsLast7d?: number;
  /** Standard / Elite: leads in the 7 IST days before that window. */
  leadsPrev7d?: number;
  /** Standard / Elite: approx net follower growth across accounts, 7d window ending yesterday. */
  followersNet7d?: number;
  /** Used for engagement-drop nudges; avg daily likes over 7 IST days before yesterday. */
  avgLikesPrior7d?: number;
};

/** YYYY-MM-DD in Asia/Kolkata for the given instant. */
export function istYmd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(d);
}

/** Start/end UTC instants for an IST calendar day YYYY-MM-DD. */
export function istDayRangeUtc(ymd: string): { start: Date; end: Date } {
  const [y, mo, da] = ymd.split("-").map((x) => Number(x));
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = new Date(`${y}-${pad(mo)}-${pad(da)}T00:00:00+05:30`);
  const end = new Date(`${y}-${pad(mo)}-${pad(da)}T23:59:59.999+05:30`);
  return { start, end };
}

function ownerDisplayName(name: string | null | undefined, email: string): string {
  const n = name?.trim();
  if (n) return n.split(/\s+/)[0] ?? n;
  return email.split("@")[0] ?? "there";
}

async function followerCountForDay(socialAccountId: string, start: Date, end: Date): Promise<number | null> {
  const row = await prisma.followerDaily.findFirst({
    where: {
      socialAccountId,
      date: { gte: start, lte: end }
    },
    orderBy: { date: "desc" },
    select: { followerCount: true }
  });
  return row?.followerCount ?? null;
}

export type GetBriefingDataOptions = {
  /** Extra aggregates for Standard / Elite tier briefings (one more DB round-trip). */
  expandedMetrics?: boolean;
};

/**
 * Aggregates yesterday (IST) stats for a client. Never throws — returns zeros / nulls on missing data.
 */
export async function getBriefingData(clientId: string, opts?: GetBriefingDataOptions): Promise<BriefingData> {
  const empty: BriefingData = {
    businessName: "your business",
    ownerName: "there",
    newFollowers: 0,
    totalFollowers: 0,
    newLeads: 0,
    likesYesterday: 0,
    commentsYesterday: 0,
    topPost: null,
    scheduledToday: 0
  };

  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        owner: { select: { name: true, email: true } },
        socialAccounts: { select: { id: true, followerCount: true } }
      }
    });

    if (!client) return empty;

    const businessName = client.name || empty.businessName;
    const ownerName = ownerDisplayName(client.owner.name, client.owner.email);

    const todayIst = istYmd(new Date());
    const anchor = new Date(`${todayIst}T12:00:00+05:30`);
    const yesterdayStart = new Date(anchor.getTime() - 86400000);
    const yesterdayYmd = istYmd(yesterdayStart);
    const dayBeforeYmd = istYmd(new Date(anchor.getTime() - 2 * 86400000));

    const yRange = istDayRangeUtc(yesterdayYmd);
    const dbRange = istDayRangeUtc(dayBeforeYmd);

    let newFollowers = 0;
    let totalFollowers = 0;

    for (const acc of client.socialAccounts) {
      totalFollowers += acc.followerCount ?? 0;

      const yCount = await followerCountForDay(acc.id, yRange.start, yRange.end);
      const prevCount = await followerCountForDay(acc.id, dbRange.start, dbRange.end);

      if (yCount != null && prevCount != null) {
        newFollowers += Math.max(0, yCount - prevCount);
      }
    }

    const newLeads = await prisma.lead.count({
      where: {
        clientId,
        createdAt: { gte: yRange.start, lte: yRange.end }
      }
    });

    const yesterdayMetrics = await prisma.postMetricDaily.aggregate({
      where: {
        date: { gte: yRange.start, lte: yRange.end },
        post: { socialAccount: { clientId } }
      },
      _sum: { likes: true, commentsCount: true }
    });
    const likesYesterday = yesterdayMetrics._sum.likes ?? 0;
    const commentsYesterday = yesterdayMetrics._sum.commentsCount ?? 0;

    const topMetric = await prisma.postMetricDaily.findFirst({
      where: {
        date: { gte: yRange.start, lte: yRange.end },
        post: { socialAccount: { clientId } }
      },
      orderBy: [{ reach: "desc" }, { likes: "desc" }],
      include: {
        post: { select: { content: true } }
      }
    });

    let topPost: BriefingData["topPost"] = null;
    if (topMetric) {
      topPost = {
        caption: (topMetric.post.content ?? "").trim() || "(no caption)",
        reach: topMetric.reach,
        likes: topMetric.likes
      };
    } else {
      const posts = await prisma.post.findMany({
        where: {
          socialAccount: { clientId },
          publishedAt: { gte: yRange.start, lte: yRange.end }
        },
        select: { content: true, engagementStats: true }
      });
      let best: { caption: string; reach: number; likes: number } | null = null;
      for (const p of posts) {
        const stats = p.engagementStats as { likes?: number; reach?: number } | null;
        const likes = typeof stats?.likes === "number" ? stats.likes : 0;
        const reach = typeof stats?.reach === "number" ? stats.reach : likes;
        if (!best || likes > best.likes || (likes === best.likes && reach > best.reach)) {
          best = {
            caption: (p.content ?? "").trim() || "(no caption)",
            reach,
            likes
          };
        }
      }
      topPost = best;
    }

    const todayRange = istDayRangeUtc(todayIst);
    const scheduledToday = await prisma.scheduledPost.count({
      where: {
        clientId,
        status: OutboundPostStatus.SCHEDULED,
        scheduledAt: { gte: todayRange.start, lte: todayRange.end }
      }
    });

    let leadsLast7d: number | undefined;
    let leadsPrev7d: number | undefined;
    let followersNet7d: number | undefined;
    let avgLikesPrior7d: number | undefined;

    if (opts?.expandedMetrics) {
      const sevenStart = new Date(yRange.start.getTime() - 6 * 86400000);
      leadsLast7d = await prisma.lead.count({
        where: { clientId, createdAt: { gte: sevenStart, lte: yRange.end } }
      });
      const prevEnd = new Date(sevenStart.getTime() - 1);
      const fourteenStart = new Date(sevenStart.getTime() - 7 * 86400000);
      leadsPrev7d = await prisma.lead.count({
        where: { clientId, createdAt: { gte: fourteenStart, lte: prevEnd } }
      });

      const startYmd = istYmd(sevenStart);
      const startRange = istDayRangeUtc(startYmd);
      let net = 0;
      for (const acc of client.socialAccounts) {
        const endC = await followerCountForDay(acc.id, yRange.start, yRange.end);
        const startC = await followerCountForDay(acc.id, startRange.start, startRange.end);
        if (endC != null && startC != null) net += endC - startC;
      }
      followersNet7d = net;

      const priorWindowEnd = new Date(yRange.start.getTime() - 1);
      const priorWindowStart = new Date(yRange.start.getTime() - 7 * 86400000);
      const priorAgg = await prisma.postMetricDaily.aggregate({
        where: {
          date: { gte: priorWindowStart, lte: priorWindowEnd },
          post: { socialAccount: { clientId } }
        },
        _sum: { likes: true }
      });
      avgLikesPrior7d = Math.round(((priorAgg._sum.likes ?? 0) / 7) * 10) / 10;
    }

    return {
      businessName,
      ownerName,
      newFollowers,
      totalFollowers,
      newLeads,
      likesYesterday,
      commentsYesterday,
      topPost,
      scheduledToday,
      leadsLast7d,
      leadsPrev7d,
      followersNet7d,
      avgLikesPrior7d
    };
  } catch (err) {
    logger.warn("[briefingData] getBriefingData failed", {
      clientId,
      message: err instanceof Error ? err.message : String(err)
    });
    return empty;
  }
}
