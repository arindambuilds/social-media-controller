import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { assertTenantAccess } from "../middleware/assertTenantAccess";
import { tenantRateLimit } from "../middleware/tenantRateLimit";
import { analyticsOverviewCacheKey, cacheGet, cacheSet } from "../lib/cache";
import {
  getClientOverview,
  getClientPosts,
  getEngagementTimeSeries,
  getFollowerGrowth,
  getHourlyInsights,
  getInstagramAudienceForClient,
  getMediaTypeInsights,
  getPlatformSummary
} from "../services/analyticsService";

export const analyticsRouter = Router();

analyticsRouter.use(authenticate);
analyticsRouter.use(tenantRateLimit);

analyticsRouter.get("/:clientId/overview", assertTenantAccess, async (req, res) => {
  const { clientId } = z.object({ clientId: z.string().min(1) }).parse(req.params);
  const days = z.coerce.number().int().min(1).max(365).default(30).parse(req.query.days ?? 30);

  const cacheKey = analyticsOverviewCacheKey(clientId, days);
  const cached = await cacheGet<Record<string, unknown>>(cacheKey);
  if (cached) {
    res.json({ ...cached, cacheHit: true });
    return;
  }

  const overview = await getClientOverview(clientId, days);
  const { points } = await getEngagementTimeSeries(clientId, days);
  const followerGrowth = await getFollowerGrowth(clientId, days);
  const ig = await getInstagramAudienceForClient(clientId);

  const payload = {
    success: true,
    ...overview,
    timeSeries: { points },
    followerGrowth,
    followerCount: ig?.followerCount ?? null,
    instagramHandle: ig?.platformUsername ?? null,
    lastSyncedAt: ig?.lastSyncedAt?.toISOString() ?? null,
    cacheHit: false
  };

  await cacheSet(cacheKey, payload);
  res.json(payload);
});

analyticsRouter.get("/:clientId/posts", assertTenantAccess, async (req, res) => {
  const { clientId } = z.object({ clientId: z.string().min(1) }).parse(req.params);
  const limit = z.coerce.number().int().min(1).max(100).default(20).parse(req.query.limit ?? 20);
  const sort = z.enum(["engagement", "recent"]).default("engagement").parse(req.query.sort ?? "engagement");
  const posts = await getClientPosts(clientId, limit, sort);
  res.json({ success: true, posts });
});

analyticsRouter.get("/:clientId/insights/hourly", assertTenantAccess, async (req, res) => {
  const { clientId } = z.object({ clientId: z.string().min(1) }).parse(req.params);
  const hourly = await getHourlyInsights(clientId);
  res.json({ success: true, ...hourly });
});

analyticsRouter.get("/:clientId/insights/media-type", assertTenantAccess, async (req, res) => {
  const { clientId } = z.object({ clientId: z.string().min(1) }).parse(req.params);
  const media = await getMediaTypeInsights(clientId);
  res.json({ success: true, ...media });
});

analyticsRouter.get("/:platform/:clientId/summary", assertTenantAccess, async (req, res) => {
  const params = z
    .object({
      platform: z.string().min(1),
      clientId: z.string().min(1)
    })
    .parse(req.params);

  const summary = await getPlatformSummary(params.clientId, params.platform.toUpperCase());
  res.json({ success: true, ...summary });
});
