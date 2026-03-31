import type { Job } from "bullmq";
import { Worker } from "bullmq";
import { redisConnection } from "../lib/redis";
import { logger } from "../lib/logger";
import { queueNames } from "../queues/queueNames";
import type { BriefingJob } from "../queues/briefingQueue";
import { toBullMqProcessorError } from "../lib/bullmqRetry";
import { runBriefingNow } from "../jobs/morningBriefing";
import { runMorningBriefingDispatchTick } from "../jobs/scheduleMorningBriefing";
import { jobLogMarkActive, jobLogMarkCompleted, jobLogMarkFailed } from "../services/jobLogService";
import { logSystemEvent } from "../services/systemEventService";

export function startBriefingWorker(): Worker<BriefingJob> | null {
  if (!redisConnection) return null;

  const worker = new Worker<BriefingJob>(
    queueNames.briefing,
    async (job: Job<BriefingJob>) => {
      const q = queueNames.briefing;
      const jid = String(job.id);
      await jobLogMarkActive({
        queue: q,
        jobId: jid,
        name: job.name,
        data:
          job.name === "dispatch-hour"
            ? { dispatch: true }
            : { clientId: job.data?.clientId ?? null },
        attempts: job.attemptsMade
      });
      try {
        if (job.name === "dispatch-hour") {
          await runMorningBriefingDispatchTick();
          await jobLogMarkCompleted({
            queue: q,
            jobId: jid,
            attempts: job.attemptsMade,
            result: { dispatch: true }
          });
          return;
        }
        const clientId = job.data?.clientId;
        if (!clientId) {
          throw new Error("briefing job missing clientId");
        }
        await runBriefingNow(clientId);
        await jobLogMarkCompleted({
          queue: q,
          jobId: jid,
          attempts: job.attemptsMade,
          result: { clientId }
        });
      } catch (err) {
        const e = toBullMqProcessorError(err);
        await jobLogMarkFailed({
          queue: q,
          jobId: jid,
          error: e.message,
          attempts: job.attemptsMade
        });
        throw e;
      }
    },
    {
      connection: redisConnection,
      concurrency: 3,
      maxStalledCount: 2,
      stalledInterval: 30_000
    }
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
