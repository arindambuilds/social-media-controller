import "dotenv/config";
import type { Worker } from "bullmq";
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
import { whatsappSendQueue } from "./queues/whatsappSendQueue";
import { PdfService } from "./services/pdfService";
import { startBriefingWorker } from "./workers/briefingWorker";
import { initMaintenanceJobs, startMaintenanceWorker } from "./workers/maintenanceWorker";
import { startPdfWorker } from "./workers/pdfWorker";
import { startWhatsAppBriefingWorker } from "./workers/whatsappBriefingWorker";
import { gracefulShutdownWhatsAppWorker, startWhatsAppSendWorker } from "./workers/whatsappWorker";

/**
 * Default: embed PDF worker when Redis is on (single-dyno friendly).
 * Set `START_PDF_WORKER_IN_API=false` and run `npm run worker:pdf` separately to isolate Puppeteer from the API (OOM mitigation).
 */
function shouldEmbedPdfWorkerInApiProcess(): boolean {
  if (!redisConnection) return false;
  return process.env.START_PDF_WORKER_IN_API !== "false";
}

if (process.env.NODE_ENV === "production") {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (
    dbUrl.includes("localhost") ||
    dbUrl.includes("127.0.0.1") ||
    dbUrl.includes("@0.0.0.0")
  ) {
    console.error(
      "FATAL: DATABASE_URL points to localhost in production. " +
        "Set DATABASE_URL to the Supabase transaction pooler (:6543) and DIRECT_URL to the direct Postgres connection (:5432) in your production environment variables."
    );
    process.exit(1);
  }
}

const app = createApp();
const PORT = Number(process.env.PORT) || 8080;

let workerBriefing: Worker | null = null;
let workerPdf: Worker | null = null;
let workerMaintenance: Worker | null = null;
let workerWhatsAppBriefing: Worker | null = null;
let workerWhatsAppSend: Worker | null = null;

if (process.env.NODE_ENV === "production" && redisConnection) {
  if (pdfQueue && process.env.START_PDF_WORKER_IN_API === "false") {
    console.warn(
      "[pulse] In-process PDF worker disabled — ensure a separate service runs `npm run worker:pdf` or PDF exports will stall."
    );
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
  if (workerMaintenance) registerShutdownHook(() => workerMaintenance!.close());
  const pq = pdfQueue;
  if (pq) registerShutdownHook(() => pq.close());
  const bq = briefingQueue;
  if (bq) registerShutdownHook(() => bq.close());
  const wbq = whatsappBriefingQueue;
  if (wbq) registerShutdownHook(() => wbq.close());
  const wsq = whatsappSendQueue;
  if (wsq) registerShutdownHook(() => wsq.close());
  registerShutdownHook(() => PdfService.closeSharedBrowser());
}

registerQueueShutdownHooks();

void printStartupSummary(PORT);

const server = app.listen(PORT, "0.0.0.0", () => {
  const inst =
    process.env.NODE_APP_INSTANCE ?? process.env.pm_id ?? process.env.INSTANCE_ID ?? "0";
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Instance: ${inst}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

installProcessShutdownHandlers(async () => {
  await runShutdownHooks();
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

server.on("error", (err) => {
  console.error("Server error:", err);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

export default app;
