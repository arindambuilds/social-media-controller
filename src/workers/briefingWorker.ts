import type { Job } from "bullmq";
import { Worker } from "bullmq";
import { redisConnection } from "../lib/redis";
import { logger } from "../lib/logger";
import { queueNames } from "../queues/queueNames";
import type { BriefingJob } from "../queues/briefingQueue";
import { runBriefingNow } from "../jobs/morningBriefing";
import { logSystemEvent } from "../services/systemEventService";

export function startBriefingWorker(): Worker<BriefingJob> | null {
  if (!redisConnection) return null;

  const worker = new Worker<BriefingJob>(
    queueNames.briefing,
    async (job: Job<BriefingJob>) => {
      await runBriefingNow(job.data.clientId);
    },
    { connection: redisConnection, concurrency: 2 }
  );

  worker.on("failed", (job, err) => {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn("[briefingWorker] job failed", {
      jobId: job?.id,
      clientId: job?.data?.clientId,
      attempts: job?.attemptsMade,
      message: msg
    });
    if ((job?.attemptsMade ?? 0) >= 3) {
      void logSystemEvent(
        "briefing",
        "error",
        `Briefing failed after retries: ${msg}`,
        { clientId: job?.data?.clientId, jobId: job?.id }
      );
    }
  });

  worker.on("completed", (job) => {
    logger.info("[briefingWorker] completed", { jobId: job.id, clientId: job.data.clientId });
  });

  logger.info("Briefing worker started");
  return worker;
}
