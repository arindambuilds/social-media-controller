import type { Job } from "bullmq";
import { Worker } from "bullmq";
import { redisConnection } from "../lib/redis";
import { logger } from "../lib/logger";
import { queueNames } from "../queues/queueNames";
import type { MaintenanceJob } from "../queues/maintenanceQueue";
import { runWeeklyDatabaseCleanup } from "../jobs/databaseCleanup";
import { registerWeeklyDatabaseCleanupJob } from "../queues/maintenanceQueue";

export function startMaintenanceWorker(): Worker<MaintenanceJob> | null {
  if (!redisConnection) return null;

  const worker = new Worker<MaintenanceJob>(
    queueNames.maintenance,
    async (job: Job<MaintenanceJob>) => {
      if (job.name === "db-cleanup") {
        await runWeeklyDatabaseCleanup();
        return;
      }
      logger.warn("[maintenanceWorker] unknown job", { name: job.name });
    },
    { connection: redisConnection, concurrency: 1 }
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
}
