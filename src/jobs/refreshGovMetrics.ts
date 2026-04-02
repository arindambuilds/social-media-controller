import { prisma } from "../lib/prisma";
import { redisConnection } from "../lib/redis";

export const GOV_METRICS_REDIS_KEY = "briefing:gov:metrics";
export const GOV_METRICS_TTL_SEC = 21600;

export type GovMetricsPayload = {
  msmes: number;
  leadsThisWeek: number;
  odiaPercent: number;
  updatedAt: string;
};

/**
 * Aggregates anonymized statewide-style metrics for /gov-preview; caches in Redis.
 */
export async function runRefreshGovMetrics(): Promise<GovMetricsPayload> {
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const [msmes, leadsThisWeek, odiaCount, clientCount] = await Promise.all([
    prisma.client.count({ where: { briefingEnabled: true } }),
    prisma.lead.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.client.count({ where: { language: "or" } }),
    prisma.client.count()
  ]);
  const odiaPercent =
    clientCount === 0 ? 0 : Math.round((odiaCount / clientCount) * 1000) / 10;
  const payload: GovMetricsPayload = {
    msmes,
    leadsThisWeek,
    odiaPercent,
    updatedAt: new Date().toISOString()
  };
  if (redisConnection) {
    await redisConnection.set(GOV_METRICS_REDIS_KEY, JSON.stringify(payload), "EX", GOV_METRICS_TTL_SEC);
  }
  return payload;
}
