import type { Worker } from "bullmq";
/** Load `.env` before any module that reads `process.env.DATABASE_URL` (e.g. Prisma). */
import { env } from "./config/env";
import { createApp } from "./app";
import { installProcessShutdownHandlers, registerShutdownHook, runShutdownHooks } from "./lib/shutdownRegistry";
import { redisConnection } from "./lib/redis";
import { printStartupSummary } from "./lib/startupSummary";
import { startPdfPriorityRebalance } from "./jobs/pdfPriorityRebalance";
import { startPdfQueueMaintenance } from "./jobs/pdfQueueMaintenance";
import { startRedisStreamMaintenance } from "./jobs/redisStreamMaintenance";
import { briefingQueue, isBriefingNineAmDispatchMode } from "./queues/briefingQueue";
import { pdfQueue } from "./queues/pdfQueue";
import { whatsappBriefingQueue } from "./queues/whatsappBriefingQueue";
import { whatsappOutboundQueue } from "./queues/whatsappOutboundQueue";
import { whatsappSendQueue } from "./queues/whatsappSendQueue";
import { emailQueue } from "./services/email/emailQueue";
import { PdfService } from "./services/pdfService";
import { closeEmailWorker, startEmailWorker } from "./services/email/emailWorker";
import { startBriefingWorker } from "./workers/briefingWorker";
import { initMaintenanceJobs, startMaintenanceWorker } from "./workers/maintenanceWorker";
import { startPdfWorker } from "./workers/pdfWorker";
import { startWhatsAppBriefingWorker } from "./workers/whatsappBriefingWorker";
import {
  closeWhatsAppOutboundWorker,
  startWhatsAppOutboundWorker
} from "./workers/whatsappOutboundWorker";
import { gracefulShutdownWhatsAppWorker, startWhatsAppSendWorker } from "./workers/whatsappWorker";
import { scheduleMorningBriefing } from "./jobs/briefingDispatch";
import { logger } from "./lib/logger";

/**
 * Default: embed PDF worker when Redis is on (single-dyno friendly).
 * Set `START_PDF_WORKER_IN_API=false` and run `npm run worker:pdf` separately to isolate Puppeteer from the API (OOM mitigation).
 */
function shouldEmbedPdfWorkerInApiProcess(): boolean {
  if (!redisConnection) return false;
  return process.env.START_PDF_WORKER_IN_API !== "false";
}

/** Meta Cloud outbound sends; set `START_WA_OUTBOUND_WORKER_IN_API=false` when a dedicated worker dyno runs `npm run worker:wa:outbound`. */
function shouldEmbedWhatsAppOutboundWorkerInApi(): boolean {
  if (!redisConnection) return false;
  const v = env.START_WA_OUTBOUND_WORKER_IN_API.trim().toLowerCase();
  return v !== "false" && v !== "0";
}

/** Queue-first email sends; set `START_EMAIL_WORKER_IN_API=false` and run `npm run worker:email` separately. */
function shouldEmbedEmailWorkerInApi(): boolean {
  if (!redisConnection) return false;
  const v = process.env.START_EMAIL_WORKER_IN_API?.trim().toLowerCase();
  return v !== "false" && v !== "0";
}

if (process.env.NODE_ENV === "production") {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (
    dbUrl.includes("localhost") ||
    dbUrl.includes("127.0.0.1") ||
    dbUrl.includes("@0.0.0.0")
  ) {
    logger.error("FATAL: DATABASE_URL points to localhost in production", {
      event: "fatal_database_url_localhost"
    });
    process.exit(1);
  }
}

const app = createApp();
/** Render injects `PORT`; local dev defaults to 4000. */
const PORT = parseInt(process.env.PORT || "4000", 10);

let workerBriefing: Worker | null = null;
let workerPdf: Worker | null = null;
let workerMaintenance: Worker | null = null;
let workerWhatsAppBriefing: Worker | null = null;
let workerWhatsAppSend: Worker | null = null;
let workerWhatsAppOutbound: Worker | null = null;
let workerEmail: Worker | null = null;

if (process.env.NODE_ENV === "production" && redisConnection) {
  if (pdfQueue && process.env.START_PDF_WORKER_IN_API === "false") {
    logger.warn("[pulse] In-process PDF worker disabled", { hint: "run npm run worker:pdf" });
  }
  if (!shouldEmbedWhatsAppOutboundWorkerInApi()) {
    logger.warn("[pulse] In-process Meta WhatsApp outbound worker disabled", {
      hint:
        "Run a separate worker with the same branch/REDIS_URL: npm run worker:wa:outbound (or node dist/workers/whatsappOutboundWorkerEntry.js), e.g. Render service pulse-whatsapp-outbound-worker — or set START_WA_OUTBOUND_WORKER_IN_API=true on the API"
    });
  }
  workerBriefing = startBriefingWorker();
  if (shouldEmbedPdfWorkerInApiProcess()) {
    workerPdf = startPdfWorker();
  }
  workerMaintenance = startMaintenanceWorker();
  if (isBriefingNineAmDispatchMode()) {
    workerWhatsAppBriefing = startWhatsAppBriefingWorker();
  }
  workerWhatsAppSend = startWhatsAppSendWorker();
  if (shouldEmbedWhatsAppOutboundWorkerInApi()) {
    workerWhatsAppOutbound = startWhatsAppOutboundWorker();
    if (!workerWhatsAppOutbound) {
      logger.warn("[pulse] Meta WhatsApp outbound worker did not start — whatsapp-outbound jobs will not be processed", {
        hint: "Check REDIS_URL / BullMQ connection, or run a dedicated worker: npm run worker:wa:outbound"
      });
    }
  }
  if (shouldEmbedEmailWorkerInApi()) {
    try {
      workerEmail = startEmailWorker();
    } catch (err) {
      logger.warn("[pulse] Email worker did not start — queued emails will not send", {
        message: err instanceof Error ? err.message : String(err),
        hint: "Set POSTMARK_API_TOKEN (or SES) and REDIS_URL, or run npm run worker:email"
      });
    }
  } else {
    logger.warn("[pulse] In-process email worker disabled", {
      hint: "Run npm run worker:email with same REDIS_URL, or set START_EMAIL_WORKER_IN_API=true"
    });
  }
  void initMaintenanceJobs();
  startPdfQueueMaintenance();
  startRedisStreamMaintenance();
  startPdfPriorityRebalance();
}

function registerQueueShutdownHooks(): void {
  if (workerPdf) registerShutdownHook(() => workerPdf!.close());
  if (workerBriefing) registerShutdownHook(() => workerBriefing!.close());
  if (workerWhatsAppBriefing) registerShutdownHook(() => workerWhatsAppBriefing!.close());
  if (workerWhatsAppSend) {
    registerShutdownHook(async () => {
      await gracefulShutdownWhatsAppWorker(workerWhatsAppSend!);
    });
  }
  if (workerWhatsAppOutbound) {
    registerShutdownHook(async () => closeWhatsAppOutboundWorker(workerWhatsAppOutbound!));
  }
  if (workerEmail) {
    registerShutdownHook(async () => closeEmailWorker(workerEmail!));
  }
  if (workerMaintenance) registerShutdownHook(() => workerMaintenance!.close());
  const pq = pdfQueue;
  if (pq) registerShutdownHook(() => pq.close());
  const bq = briefingQueue;
  if (bq) registerShutdownHook(() => bq.close());
  const wbq = whatsappBriefingQueue;
  if (wbq) registerShutdownHook(() => wbq.close());
  const wsq = whatsappSendQueue;
  if (wsq) registerShutdownHook(() => wsq.close());
  const woq = whatsappOutboundQueue;
  if (woq) registerShutdownHook(() => woq.close());
  const eq = emailQueue;
  if (eq) registerShutdownHook(() => eq.close());
  registerShutdownHook(() => PdfService.closeSharedBrowser());
}

registerQueueShutdownHooks();

scheduleMorningBriefing();

const server = app.listen(PORT, "0.0.0.0", () => {
  logger.info({
    message: "Server ready",
    port: PORT,
    environment: process.env.NODE_ENV,
    service: "social-media-controller"
  });
  void printStartupSummary(PORT);
});

installProcessShutdownHandlers(async () => {
  await runShutdownHooks();
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

server.on("error", (err) => {
  logger.error("Server error", { message: err instanceof Error ? err.message : String(err) });
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception", { message: err instanceof Error ? err.message : String(err) });
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection", { reason: String(reason) });
});

export default app;
