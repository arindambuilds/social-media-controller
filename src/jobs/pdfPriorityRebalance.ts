import { logger } from "../lib/logger";
import { computeFairPdfQueuePriority, inferPdfRoleBaseFromStoredPriority } from "../lib/pdfFairPriority";
import { pdfQueue } from "../queues/pdfQueue";
import type { PdfGenerateJob } from "../queues/pdfQueue";

const INTERVAL_MS = 30_000;
const MAX_JOBS_PER_TICK = 200;

/**
 * Periodically raises BullMQ priority for waiting PDF jobs as they age, so CLIENT_USER / default
 * exports can pass a backlog of fresh AGENCY jobs (mitigates priority starvation).
 */
export function startPdfPriorityRebalance(): void {
  const q = pdfQueue;
  if (!q) return;

  const run = (): void => {
    void (async () => {
      const now = Date.now();
      let updated = 0;
      try {
        const jobs = await q.getJobs(["prioritized"], 0, MAX_JOBS_PER_TICK - 1);
        for (const job of jobs) {
          const data = job.data as PdfGenerateJob;
          const tier =
            typeof data.pdfRoleBase === "number"
              ? data.pdfRoleBase
              : inferPdfRoleBaseFromStoredPriority(job.priority ?? job.opts.priority);
          const enqueuedAtMs = typeof data.enqueuedAtMs === "number" ? data.enqueuedAtMs : job.timestamp;
          const nextP = computeFairPdfQueuePriority(tier, enqueuedAtMs, now);
          const currentP = typeof job.priority === "number" ? job.priority : (job.opts.priority ?? 0);
          if (nextP > currentP) {
            await job.changePriority({ priority: nextP });
            updated++;
          }
        }
        if (updated > 0) {
          logger.info("pdf_priority_rebalanced", { updated, scanned: jobs.length });
        }
      } catch (e) {
        logger.warn("pdf_priority_rebalance_failed", {
          message: e instanceof Error ? e.message : String(e)
        });
      }
    })();
  };

  run();
  setInterval(run, INTERVAL_MS);
}
