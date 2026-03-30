import { logMetric, logger } from "./logger";
import { pdfQueue } from "../queues/pdfQueue";
import { takeAndResetEnqueueCounters } from "./pdfQueueObservability";

/**
 * Emits PDF enqueue mix since last flush + BullMQ depth / visible completion snapshot.
 * Runs on the API tick (e.g. every 5 min with Redis maintenance).
 */
export async function flushPdfQueueMetrics(): Promise<void> {
  const snap = takeAndResetEnqueueCounters();
  logMetric("queue_priority_dist_agency", snap.agency);
  logMetric("queue_priority_dist_client", snap.client);
  logMetric("queue_priority_dist_free", snap.free);

  if (!pdfQueue) return;

  try {
    const c = await pdfQueue.getJobCounts();
    logMetric("pdf_queue_waiting", c.waiting);
    logMetric("pdf_queue_active", c.active);
    logMetric("pdf_queue_failed", c.failed);
    logMetric("pdf_queue_completed_visible", c.completed);

    const denom = c.completed + c.failed;
    if (denom > 0) {
      const ratio = c.failed / denom;
      logMetric("pdf_queue_failure_ratio", Math.round(ratio * 1000) / 1000, {
        completed: c.completed,
        failed: c.failed
      });
    }

    const inst = process.env.NODE_APP_INSTANCE ?? process.env.pm_id ?? process.env.INSTANCE_ID ?? "0";
    const rssMb = process.memoryUsage().rss / (1024 * 1024);
    logMetric("api_process_rss_mb", Math.round(rssMb * 100) / 100, {
      instance: inst,
      queueWaiting: c.waiting
    });
  } catch (e) {
    logger.warn("pdf_queue_metrics_flush_failed", {
      message: e instanceof Error ? e.message : String(e)
    });
  }
}
