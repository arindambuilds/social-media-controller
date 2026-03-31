import type { Job } from "bullmq";
import { Worker } from "bullmq";
import { redisConnection } from "../lib/redis";
import { logger } from "../lib/logger";
import { queueNames } from "../queues/queueNames";
import type { WhatsAppSendBriefJob } from "../queues/whatsappSendQueue";
import { executeWhatsAppSendJob, whatsappSendDepsFromRedis } from "../services/whatsappSendExecutor";
import { jobLogMarkActive, jobLogMarkCompleted, jobLogMarkFailed } from "../services/jobLogService";
import { toBullMqProcessorError } from "../lib/bullmqRetry";

/**
 * Twilio-only worker: job data must already include `briefingText` from scheduler (`runBriefingNow`).
 * This processor must not invoke the LLM SDK; that is enforced by
 * `tests/briefingDispatch.test.ts` and by repository greps for SDK call patterns in this file.
 */
export function startWhatsAppSendWorker(): Worker<WhatsAppSendBriefJob> | null {
  if (!redisConnection) return null;

  const worker = new Worker<WhatsAppSendBriefJob>(
    queueNames.whatsappSend,
    async (job: Job<WhatsAppSendBriefJob>) => {
      const q = queueNames.whatsappSend;
      const jid = String(job.id);
      await jobLogMarkActive({
        queue: q,
        jobId: jid,
        name: job.name,
        data: { phone: job.data.phoneE164 },
        attempts: job.attemptsMade
      });
      try {
        if (job.name !== "send-brief") {
          throw new Error(`Unknown whatsapp send job: ${job.name}`);
        }
        const deps = whatsappSendDepsFromRedis(redisConnection!);
        await executeWhatsAppSendJob(job.data, deps);
        await jobLogMarkCompleted({
          queue: q,
          jobId: jid,
          attempts: job.attemptsMade,
          result: { sent: true }
        });
      } catch (err) {
        const e = toBullMqProcessorError(err);
        await jobLogMarkFailed({ queue: q, jobId: jid, error: e.message, attempts: job.attemptsMade });
        throw e;
      }
    },
    {
      connection: redisConnection,
      concurrency: 10,
      stalledInterval: 30_000,
      maxStalledCount: 1,
      lockDuration: 30_000,
      lockRenewTime: 15_000,
      skipStalledCheck: false
    }
  );

  worker.on("failed", (job, err) => {
    logger.warn("[whatsappWorker] job failed", {
      jobId: job?.id,
      message: err instanceof Error ? err.message : String(err)
    });
  });

  logger.info("WhatsApp send worker started (queue: whatsapp-send)");
  return worker;
}

export async function gracefulShutdownWhatsAppWorker(worker: Worker): Promise<void> {
  await worker.pause();
  await worker.close();
}
