import type { Job } from "bullmq";
import { Worker } from "bullmq";
import { redisConnection } from "../lib/redis";
import { logger } from "../lib/logger";
import { queueNames } from "../queues/queueNames";
import type { MaintenanceJob } from "../queues/maintenanceQueue";
import { runWeeklyDatabaseCleanup } from "../jobs/databaseCleanup";
import { registerGovMetricsRefreshJob, registerWeeklyDatabaseCleanupJob } from "../queues/maintenanceQueue";
import { runRefreshGovMetrics } from "../jobs/refreshGovMetrics";
import { isBriefingNineAmDispatchMode, registerMorningBriefingDispatchRepeatable } from "../queues/briefingQueue";
import { registerWhatsAppBriefingNineAmRepeatable } from "../queues/whatsappBriefingQueue";

export function startMaintenanceWorker(): Worker<MaintenanceJob> | null {
  if (!redisConnection) return null;

  const worker = new Worker<MaintenanceJob>(
    queueNames.maintenance,
    async (job: Job<MaintenanceJob>) => {
      if (job.name === "db-cleanup") {
        await runWeeklyDatabaseCleanup();
        return;
      }
      if (job.name === "gov-metrics-refresh") {
        await runRefreshGovMetrics();
        return;
      }
      logger.warn("[maintenanceWorker] unknown job", { name: job.name });
    },
    { connection: redisConnection, concurrency: 1, stalledInterval: 60_000, lockDuration: 60_000, lockRenewTime: 30_000, drainDelay: 10 }
  );

  worker.on("failed", (job, err) => {
    logger.error("[maintenanceWorker] job failed", {
      jobId: job?.id,
      message: err instanceof Error ? err.message : String(err)
    });
  });

  logger.info("Maintenance worker started");
  return worker;
}

export async function initMaintenanceJobs(): Promise<void> {
  if (!redisConnection) return;
  try {
    await registerWeeklyDatabaseCleanupJob();
    logger.info("Weekly database cleanup repeatable job registered");
  } catch (err) {
    logger.warn("registerWeeklyDatabaseCleanupJob failed", {
      message: err instanceof Error ? err.message : String(err)
    });
  }
  try {
    await registerMorningBriefingDispatchRepeatable();
    if (!isBriefingNineAmDispatchMode()) {
      logger.info("Morning briefing BullMQ repeatable registered (hourly :00 Asia/Kolkata)");
    }
  } catch (err) {
    logger.warn("registerMorningBriefingDispatchRepeatable failed", {
      message: err instanceof Error ? err.message : String(err)
    });
  }
  if (isBriefingNineAmDispatchMode()) {
    try {
      await registerWhatsAppBriefingNineAmRepeatable();
      logger.info("Briefing: whatsapp-briefing queue @ 09:00 Asia/Kolkata (nine_am_ist mode)");
    } catch (err) {
      logger.warn("registerWhatsAppBriefingNineAmRepeatable failed", {
        message: err instanceof Error ? err.message : String(err)
      });
    }
  }
  try {
    await registerGovMetricsRefreshJob();
    logger.info("Gov metrics refresh repeatable job registered (every 6h)");
  } catch (err) {
    logger.warn("registerGovMetricsRefreshJob failed", {
      message: err instanceof Error ? err.message : String(err)
    });
  }
}
