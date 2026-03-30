import "dotenv/config";
import { installProcessShutdownHandlers, registerShutdownHook, runShutdownHooks } from "../lib/shutdownRegistry";
import { logger } from "../lib/logger";
import { pdfQueue } from "../queues/pdfQueue";
import { PdfService } from "../services/pdfService";
import { startPdfWorker } from "./pdfWorker";

const worker = startPdfWorker();
if (!worker) {
  logger.error("PDF worker requires REDIS_URL (non-localhost).");
  process.exit(1);
}

registerShutdownHook(() => worker.close());
const pq = pdfQueue;
if (pq) registerShutdownHook(() => pq.close());
registerShutdownHook(() => PdfService.closeSharedBrowser());

installProcessShutdownHandlers(async () => {
  await runShutdownHooks();
});

logger.info("Standalone PDF worker process running.");
