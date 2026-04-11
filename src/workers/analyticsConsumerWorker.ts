import type { Job, Worker } from "bullmq";
import { Worker as BullWorker } from "bullmq";
import { workerPollingOptions } from "../lib/bullmqDefaults";
import { redisConnection } from "../lib/redis";
import { logger } from "../lib/logger";
import { queueNames } from "../queues/queueNames";
import type { AnalyticsEventJob } from "../queues/analyticsQueue";
import { executeAnalyticsEventJobSync } from "../queues/analyticsQueue";

export function startAnalyticsConsumerWorker(): Worker<AnalyticsEventJob> | null {
  if (!redisConnection) {
    logger.error("Analytics consumer worker requires REDIS_URL");
    return null;
  }

  const worker = new BullWorker<AnalyticsEventJob>(queueNames.analytics, async (job: Job<AnalyticsEventJob>) => {
    await executeAnalyticsEventJobSync(job.data);
  }, {
    ...workerPollingOptions,
    connection: redisConnection,
    concurrency: 5
  });

  worker.on("completed", (job) => {
    logger.info("Analytics event processed", {
      jobId: job.id,
      eventType: job.data.eventType,
      userId: job.data.userId
    });
  });

  worker.on("failed", (job, err) => {
    logger.warn("Analytics event processing failed", {
      jobId: job?.id,
      eventType: job?.data?.eventType,
      userId: job?.data?.userId,
      error: err instanceof Error ? err.message : String(err)
    });
  });

  logger.info("Analytics consumer worker started");
  return worker;
}
