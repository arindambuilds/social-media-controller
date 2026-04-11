import type { Job } from "bullmq";
import { Worker } from "bullmq";
import { workerPollingOptions } from "../lib/bullmqDefaults";
import { createBullMqConnection } from "../lib/redis";
import { logger } from "../lib/logger";
import { queueNames } from "../queues/queueNames";
import type { PdfGenerateJob } from "../queues/pdfQueue";
import { logMetric } from "../lib/logger";
import { buildClientReportHtml } from "../services/reportHtmlBuilder";
import { toBullMqProcessorError } from "../lib/bullmqRetry";
import { jobLogMarkActive, jobLogMarkCompleted, jobLogMarkFailed } from "../services/jobLogService";
import { PdfService } from "../services/pdfService";
import { pdfQueue } from "../queues/pdfQueue";
import { saveReportPdf, updateReportStatus } from "../services/reportService";

/**
 * Cap concurrent Puppeteer work — shared browser + pages; 2 reduces OOM risk on 4GB dynos.
 * BullMQ v5 Worker already recovers stalled jobs — do not manually move stalled jobs to failed.
 */
const PDF_WORKER_CONCURRENCY = 3;

export function startPdfWorker(): Worker<PdfGenerateJob> | null {
  const workerConnection = createBullMqConnection();
  if (!workerConnection) return null;

  const worker = new Worker<PdfGenerateJob>(
    queueNames.pdfGenerate,
    async (job: Job<PdfGenerateJob>) => {
      const memBefore = process.memoryUsage().rss;
      const q = queueNames.pdfGenerate;
      const jid = String(job.id);
      await jobLogMarkActive({
        queue: q,
        jobId: jid,
        name: job.name,
        data: {
          clientId: job.data.clientId,
          userId: job.data.userId,
          reportType: job.data.reportType
        },
        attempts: job.attemptsMade
      });
      try {
        const { clientId, userId, reportType, reportId } = job.data;
        const built = await buildClientReportHtml({ clientId, userId, reportType });
        const pdf = await PdfService.generatePdf({
          html: built.html,
          options: {
            format: "A4",
            margin: { top: "16mm", right: "12mm", bottom: "16mm", left: "12mm" },
            displayHeaderFooter: true,
            footerTemplate: built.footerTemplate,
            timeoutMs: built.timeoutMs
          }
        });
        const hasQuickChart = built.html.includes("quickchart.io/chart");
        await jobLogMarkCompleted({
          queue: q,
          jobId: jid,
          attempts: job.attemptsMade,
          result: {
            hasQuickChart,
            pdfBytes: pdf.length
          }
        });

        if (reportId) {
          try {
            const pdfUrl = await saveReportPdf(reportId, pdf);
            await updateReportStatus(reportId, "ready", {
              pdfUrl,
              pdfJobId: String(job.id)
            });
          } catch (persistErr) {
            logger.error("Failed to persist generated PDF or update report status", {
              reportId,
              error: persistErr instanceof Error ? persistErr.message : String(persistErr)
            });
          }
        }

        return {
          pdfBase64: pdf.toString("base64"),
          hasQuickChart
        };
      } catch (err) {
        const e = toBullMqProcessorError(err);
        await jobLogMarkFailed({
          queue: q,
          jobId: jid,
          error: e.message,
          attempts: job.attemptsMade
        });
        throw e;
      } finally {
        try {
          const rssDeltaMb = (process.memoryUsage().rss - memBefore) / (1024 * 1024);
          logMetric("pdf_worker_job_rss_delta_mb", Math.round(rssDeltaMb * 100) / 100, { jobId: String(job.id) });
        } catch {
          /* metrics must not fail jobs */
        }
        await PdfService.notePdfJobComplete().catch(() => {});
        try {
          if (pdfQueue) {
            const c = await pdfQueue.getJobCounts();
            logMetric("pdf_queue_after_job", c.waiting, { active: c.active, failed: c.failed });
          }
        } catch {
          /* ignore */
        }
      }
    },
    {
      ...workerPollingOptions,
      connection: workerConnection,
      concurrency: PDF_WORKER_CONCURRENCY
    }
  );

  worker.on("failed", async (job, err) => {
    logger.warn("[pdfWorker] job failed", {
      jobId: job?.id,
      clientId: job?.data?.clientId,
      message: err instanceof Error ? err.message : String(err),
      attemptsMade: job?.attemptsMade,
      maxAttempts: job?.opts?.attempts
    });

    if (job?.data?.reportId && job.attemptsMade >= (job.opts?.attempts ?? 1)) {
      try {
        await updateReportStatus(job.data.reportId, "failed", {
          pdfUrl: undefined,
          failureReason: err instanceof Error ? err.message : String(err),
          pdfJobId: String(job.id)
        });
      } catch (statusErr) {
        logger.error("Failed to update report status after PDF job failure", {
          jobId: job.id,
          reportId: job.data.reportId,
          error: statusErr instanceof Error ? statusErr.message : String(statusErr)
        });
      }
    }
  });

  worker.on("completed", (job) => {
    logger.info("[pdfWorker] completed", { jobId: job.id, clientId: job.data.clientId });
  });

  logger.info("PDF worker started", { concurrency: PDF_WORKER_CONCURRENCY });
  return worker;
}
