import type { Job } from "bullmq";
import { UnrecoverableError, Worker } from "bullmq";
import type Redis from "ioredis";
import { createBullMqConnection, redisConnection } from "../lib/redis";
import { logger } from "../lib/logger";
import { queueNames } from "../queues/queueNames";
import type { PulseNormalisedWhatsAppMessage, WhatsAppIngressQueuePayload } from "../types/pulse-message.types";
import { buildMinimalWebhookBodyFromNormalised, normaliseWhatsAppCloudWebhook } from "../whatsapp/normaliser";
import { scheduleWhatsAppMediaIngest } from "../whatsapp/media.handler";
import { dispatchAgentReply } from "../whatsapp/agentReplyDispatcher";
import { getSessionContext, updateSessionFromNormalisedMessage } from "../whatsapp/session.store";
import { recordWhatsAppIngressDlq, recordWhatsAppIngressProcessed } from "../whatsapp/wa.metrics";

let workerConnection: Redis | null = null;

function isTerminalFailure(job: Job<WhatsAppIngressQueuePayload>, err: Error): boolean {
  if (err instanceof UnrecoverableError) return true;
  const attempts = Math.max(1, job.opts.attempts ?? 3);
  return job.attemptsMade >= attempts - 1;
}

export async function processWhatsAppIngressJob(data: WhatsAppIngressQueuePayload): Promise<void> {
  const incoming = data.message;
  let msg: PulseNormalisedWhatsAppMessage;
  if (incoming.payload.kind === "unknown") {
    msg = incoming;
  } else {
    const body = buildMinimalWebhookBodyFromNormalised(incoming);
    const rows = normaliseWhatsAppCloudWebhook(body);
    if (rows.length !== 1 || rows[0].messageId !== incoming.messageId) {
      throw new Error("whatsapp_ingress_normalise_mismatch");
    }
    msg = rows[0];
  }
  await updateSessionFromNormalisedMessage(redisConnection, msg);
  setImmediate(() => {
    if (redisConnection) {
      void scheduleWhatsAppMediaIngest(redisConnection, msg);
    }
  });
  recordWhatsAppIngressProcessed(msg.waId);

  if (msg.payload.kind === "text" && msg.payload.body.trim().length > 0) {
    try {
      const sessionContext = await getSessionContext(msg.waId);
      await dispatchAgentReply(msg, sessionContext);
    } catch (err) {
      logger.warn("[whatsappIngressWorker] agent reply dispatch error", {
        message: err instanceof Error ? err.message : String(err),
        waId: msg.waId
      });
    }
  }
}

export function startWhatsAppIngressWorker(): Worker<WhatsAppIngressQueuePayload> | null {
  const conn = createBullMqConnection();
  if (!conn) {
    return null;
  }
  workerConnection = conn;

  const worker = new Worker<WhatsAppIngressQueuePayload>(
    queueNames.whatsappIngress,
    async (job: Job<WhatsAppIngressQueuePayload>) => processWhatsAppIngressJob(job.data),
    {
      connection: conn,
      concurrency: 10,
      stalledInterval: 60_000,
      maxStalledCount: 1,
      lockDuration: 60_000,
      lockRenewTime: 30_000,
      drainDelay: 10
    }
  );

  worker.on("failed", (job, err) => {
    if (!job) return;
    const e = err instanceof Error ? err : new Error(String(err));
    if (!isTerminalFailure(job, e)) return;
    const waId = job.data.waId ?? "unknown";
    const reason = e.message;
    void recordWhatsAppIngressDlq(waId, reason);
  });

  worker.on("error", (err) => {
    logger.error("[whatsappIngressWorker] worker error", {
      message: err instanceof Error ? err.message : String(err)
    });
  });

  logger.info("WhatsApp ingress worker started", { queue: queueNames.whatsappIngress });
  return worker;
}

export async function closeWhatsAppIngressWorker(worker: Worker): Promise<void> {
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
