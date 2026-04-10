import type { Job } from "bullmq";
import { Worker } from "bullmq";
import { redisConnection } from "../lib/redis";
import { logger } from "../lib/logger";
import { queueNames } from "../queues/queueNames";
import type { WhatsAppBriefingJob } from "../queues/whatsappBriefingQueue";
import { runMorningBriefingDispatchTick } from "../jobs/scheduleMorningBriefing";
import { jobLogMarkActive, jobLogMarkCompleted, jobLogMarkFailed } from "../services/jobLogService";
import { toBullMqProcessorError } from "../lib/bullmqRetry";

/**
 * Dedicated queue name `whatsapp-briefing` for ops clarity; same dispatch logic as `dispatch-hour`.
 */
export function startWhatsAppBriefingWorker(): Worker<WhatsAppBriefingJob> | null {
  if (!redisConnection) return null;

  const worker = new Worker<WhatsAppBriefingJob>(
    queueNames.whatsappBriefing,
    async (job: Job<WhatsAppBriefingJob>) => {
      const q = queueNames.whatsappBriefing;
      const jid = String(job.id);
      await jobLogMarkActive({
        queue: q,
        jobId: jid,
        name: job.name,
        data: { channel: "whatsapp" },
        attempts: job.attemptsMade
      });
      try {
        if (job.name === "send-daily") {
          await runMorningBriefingDispatchTick();
          await jobLogMarkCompleted({
            queue: q,
            jobId: jid,
            attempts: job.attemptsMade,
            result: { nineAmIst: true }
          });
          return;
        }
        throw new Error(`Unknown whatsapp briefing job: ${job.name}`);
      } catch (err) {
        const e = toBullMqProcessorError(err);
        await jobLogMarkFailed({ queue: q, jobId: jid, error: e.message, attempts: job.attemptsMade });
        throw e;
      }
    },
    {
      connection: redisConnection,
      concurrency: 1,
      maxStalledCount: 2,
      stalledInterval: 60_000,
      lockDuration: 60_000,
      lockRenewTime: 30_000,
      drainDelay: 10
    }
  );

  worker.on("failed", (job, err) => {
    logger.warn("[whatsappBriefingWorker] job failed", {
      jobId: job?.id,
      message: err instanceof Error ? err.message : String(err)
    });
  });

  logger.info("WhatsApp briefing worker started (queue: whatsapp-briefing)");
  return worker;
}
