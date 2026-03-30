import { logger } from "../lib/logger";
import { pdfQueue } from "../queues/pdfQueue";

const HOUR_MS = 60 * 60 * 1000;
/** Remove failed PDF jobs older than this grace window (ms since completion). */
const FAILED_GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * Hourly trim of old failed jobs so Redis keys do not grow without bound.
 * Safe to call from API process (Queue is metadata-only); worker also fine.
 */
export function startPdfQueueMaintenance(): void {
  const q = pdfQueue;
  if (!q) return;

  const run = (): void => {
    void (async () => {
      try {
        const ids = await q.clean(FAILED_GRACE_MS, 500, "failed");
        if (ids.length > 0) {
          logger.info("pdf_queue_cleanup", { removedFailedJobs: ids.length });
        }
      } catch (e) {
        logger.warn("pdf_queue_cleanup_failed", {
          message: e instanceof Error ? e.message : String(e)
        });
      }
    })();
  };

  run();
  setInterval(run, HOUR_MS);
}
