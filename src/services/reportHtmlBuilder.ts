import { prisma } from "../lib/prisma";
import {
  getClientOverview,
  getClientPosts,
  getEngagementTimeSeries,
  getFollowerGrowth,
  getMediaTypeInsights
} from "./analyticsService";
import { reportFooterTemplate } from "../templates/reports/baseTemplate";
import { renderAnalyticsTemplate } from "../templates/reports/analyticsTemplate";
import { renderBriefingTemplate } from "../templates/reports/briefingTemplate";

export type ReportType = "briefing" | "analytics";

export type BuiltReportHtml = {
  html: string;
  periodLabel: string;
  applyWatermark: boolean;
  footerTemplate: string;
  timeoutMs: number;
};

/**
 * Shared by HTTP route and PDF worker — keeps BullMQ jobs small (ids only, no HTML in Redis).
 */
export async function buildClientReportHtml(input: {
  clientId: string;
  userId: string;
  reportType: ReportType;
}): Promise<BuiltReportHtml> {
  const { clientId, userId, reportType } = input;

  const [user, client] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { agencyName: true, name: true, brandColor: true, logoUrl: true, plan: true }
    }),
    prisma.client.findUnique({ where: { id: clientId }, select: { id: true, name: true } })
  ]);

  if (!client) {
    throw new Error("Client not found.");
  }

  const isFreePlan = (user?.plan ?? "free") === "free";
  const applyWatermark = isFreePlan;

  const [overview, latestBriefing, followerGrowth, engagementSeries, topPostsLite, mediaTypes] = await Promise.all([
    getClientOverview(clientId, 30),
    prisma.briefing.findFirst({
      where: { clientId },
      orderBy: { sentAt: "desc" },
      select: { content: true }
    }),
    getFollowerGrowth(clientId, 30),
    getEngagementTimeSeries(clientId, 30),
    getClientPosts(clientId, 8, "engagement"),
    getMediaTypeInsights(clientId)
  ]);

  const periodLabel = "Last 30 days";
  const branding = {
    agencyName: user?.agencyName ?? user?.name ?? "Pulse",
    logoUrl: user?.logoUrl ?? null,
    brandColor: user?.brandColor ?? "#06b6d4"
  };

  const contentPerfScore = Math.max(
    0,
    Math.min(100, Math.round(overview.avgEngagementRate * 1000 * 0.7 + Math.min(overview.totalPosts, 30) * 1))
  );

  const analyticsHtml = renderAnalyticsTemplate({
    branding,
    applyWatermark,
    data: {
      clientName: client.name,
      periodLabel,
      kpis: {
        followersGrowth: followerGrowth.points.length
          ? followerGrowth.points[followerGrowth.points.length - 1]!.followerCount -
            followerGrowth.points[0]!.followerCount
          : 0,
        engagementRatePct: overview.avgEngagementRate * 100,
        reach: overview.totalReach,
        impressions: Math.max(overview.totalReach * 1.3, overview.totalReach),
        contentPerformanceScore: contentPerfScore
      },
      followerTrend: followerGrowth.points.slice(-10).map((p) => ({ label: p.date.slice(5), value: p.followerCount })),
      engagementTrend: engagementSeries.points.slice(-10).map((p) => ({
        label: p.date.slice(5),
        value: p.engagementRate * 100
      })),
      postPerformance: topPostsLite.slice(0, 6).map((p, i) => ({
        label: `P${i + 1}`,
        value: p.reach ?? 0
      })),
      contentTypeBreakdown: mediaTypes.types.map((t) => ({ label: t.mediaType, value: t.postCount })),
      topPosts: topPostsLite.slice(0, 3).map((p, i) => ({
        title: `Top post ${i + 1}`,
        caption: p.captionPreview ?? "",
        thumbnailUrl: p.mediaUrl ?? null,
        likes: Math.round((p.engagementRate ?? 0) * 100),
        comments: Math.round((p.engagementRate ?? 0) * 20),
        reach: p.reach ?? 0
      }))
    }
  });

  const briefingHtml = renderBriefingTemplate({
    clientName: client.name,
    periodLabel,
    overview,
    latestBriefingText: latestBriefing?.content ?? null,
    branding,
    applyWatermark
  });

  const html = reportType === "analytics" ? analyticsHtml : briefingHtml;

  return {
    html,
    periodLabel,
    applyWatermark,
    footerTemplate: reportFooterTemplate(branding),
    timeoutMs: 20_000
  };
}
