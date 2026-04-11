import type { Job } from "bullmq";
import { UnrecoverableError, Worker } from "bullmq";
import type Redis from "ioredis";
import { workerPollingOptions } from "../lib/bullmqDefaults";
import { createBullMqConnection } from "../lib/redis";
import { logger } from "../lib/logger";
import { queueNames } from "../queues/queueNames";
import type { WhatsAppOutboundJobPayload } from "../queues/whatsappOutboundQueue";
import {
  sendWhatsAppMessage,
  type SendWhatsAppMessageResult
} from "../services/whatsappCloudApiSender";
import { recordWhatsAppOutboundDlq } from "../whatsapp/wa.metrics";

/** Pure processor for unit tests and the BullMQ worker (single Meta send call site). */
export async function processOutboundJob(
  data: WhatsAppOutboundJobPayload
): Promise<SendWhatsAppMessageResult> {
  return sendWhatsAppMessage(data);
}

let workerConnection: Redis | null = null;

function isTerminalFailure(job: Job<WhatsAppOutboundJobPayload>, err: Error): boolean {
  if (err instanceof UnrecoverableError) return true;
  const attempts = Math.max(1, job.opts.attempts ?? 4);
  return job.attemptsMade >= attempts - 1;
}

export function startWhatsAppOutboundWorker(): Worker<WhatsAppOutboundJobPayload> | null {
  const conn = createBullMqConnection();
  if (!conn) {
    return null;
  }
  workerConnection = conn;

  const worker = new Worker<WhatsAppOutboundJobPayload>(
    queueNames.whatsappOutbound,
    async (job: Job<WhatsAppOutboundJobPayload>) => processOutboundJob(job.data),
    {
      ...workerPollingOptions,
      connection: conn,
      /** Cap concurrent Graph sends — aligns with Meta throughput limits. */
      concurrency: 3
    }
  );

  worker.on("failed", (job, err) => {
    if (!job) return;
    const e = err instanceof Error ? err : new Error(String(err));
    if (!isTerminalFailure(job, e)) return;
    const waId = job.data.waId ?? "unknown";
    void recordWhatsAppOutboundDlq(waId, e.message);
  });

  worker.on("error", (err) => {
    logger.error("[whatsappOutboundWorker] worker error", {
      message: err instanceof Error ? err.message : String(err)
    });
  });

  logger.info("WhatsApp outbound worker started", { queue: queueNames.whatsappOutbound });
  return worker;
}

/** Alias for deploy docs / blueprints that use this name. */
export const createWhatsappOutboundWorker = startWhatsAppOutboundWorker;

export async function closeWhatsAppOutboundWorker(worker: Worker): Promise<void> {
  await worker.close();
  if (workerConnection) {
    try {
      await workerConnection.quit();
    } catch {
      workerConnection.disconnect();
    }
    workerConnection = null;
  }
}
