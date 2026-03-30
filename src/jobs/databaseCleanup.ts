import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { logSystemEvent } from "../services/systemEventService";

const DAY_MS = 86400000;

/**
 * Deletes old analytics rollups and system logs. Does not delete clients, users, posts, or briefings.
 */
export async function runWeeklyDatabaseCleanup(): Promise<{
  postMetricDailyDeleted: number;
  postInsightDeleted: number;
  systemEventDeleted: number;
}> {
  const cutoffMetrics = new Date(Date.now() - 90 * DAY_MS);
  const cutoffLogs = new Date(Date.now() - 30 * DAY_MS);

  const [pm, pi, ev] = await prisma.$transaction([
    prisma.postMetricDaily.deleteMany({ where: { date: { lt: cutoffMetrics } } }),
    prisma.postInsight.deleteMany({ where: { date: { lt: cutoffMetrics } } }),
    prisma.systemEvent.deleteMany({ where: { createdAt: { lt: cutoffLogs } } })
  ]);

  const summary = {
    postMetricDailyDeleted: pm.count,
    postInsightDeleted: pi.count,
    systemEventDeleted: ev.count
  };

  logger.info("[databaseCleanup] completed", summary);
  await logSystemEvent("cleanup", "info", "Weekly DB cleanup finished", summary as unknown as Record<string, unknown>);

  return summary;
}
