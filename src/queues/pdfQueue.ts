import type { JobsOptions } from "bullmq";
import type Redis from "ioredis";
import { Queue, QueueEvents } from "bullmq";
import { pdfExportCircuit } from "../lib/circuitBreaker";
import { computeFairPdfQueuePriority, pdfJobTierForRole } from "../lib/pdfFairPriority";
import { recordPdfEnqueueByTier } from "../lib/pdfQueueObservability";
import { createBullMqConnection, redisConnection } from "../lib/redis";
import { queueNames } from "./queueNames";
import type { ReportType } from "../services/reportHtmlBuilder";

export type PdfGenerateJob = {
  clientId: string;
  userId: string;
  reportType: ReportType;
  /** Role tier for fair scheduling (10 / 50 / 100). */
  pdfRoleBase?: number;
  /** When the job was enqueued (ms); used with tier for wait-weighted BullMQ priority. */
  enqueuedAtMs?: number;
};

type PdfJobResult = { pdfBase64: string; hasQuickChart?: boolean };

const defaultJobOpts: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 2000, jitter: 0.25 },
  removeOnComplete: { count: 200 },
  removeOnFail: { count: 80 }
};

/** Hard cap on worker processing time (BullMQ fails job if exceeded). */
const PDF_JOB_TIMEOUT_MS = 120_000;

/**
 * Backpressure + health probes: above these, new PDF jobs get 503.
 * BullMQ: **larger `priority` value = processed sooner** — see `computeFairPdfQueuePriority`.
 */
export const PDF_QUEUE_CAP_WAITING = 25;
export const PDF_QUEUE_CAP_ACTIVE = 5;

/** Early warning for `/api/health/degraded` (below hard reject caps). */
export const PDF_QUEUE_WARN_WAITING = 20;
export const PDF_QUEUE_WARN_ACTIVE = 4;

/** @deprecated Use `pdfJobTierForRole` from `pdfFairPriority` (same values: 100 / 50 / 10). */
export function pdfJobPriorityForRole(role: string | undefined): number {
  return pdfJobTierForRole(role);
}

export { pdfJobTierForRole } from "../lib/pdfFairPriority";

const pdfQueueConnection = createBullMqConnection();

export const pdfQueue: Queue<PdfGenerateJob> | null =
  pdfQueueConnection != null
    ? new Queue<PdfGenerateJob>(queueNames.pdfGenerate, { connection: pdfQueueConnection })
    : null;

let pdfQueueEvents: QueueEvents | null = null;
let pdfQueueEventsConnection: Redis | null = null;

async function ensurePdfQueueEvents(): Promise<QueueEvents | null> {
  if (!redisConnection || !pdfQueue) return null;
  if (!pdfQueueEvents) {
    pdfQueueEventsConnection = createBullMqConnection();
    if (!pdfQueueEventsConnection) return null;
    pdfQueueEvents = new QueueEvents(queueNames.pdfGenerate, { connection: pdfQueueEventsConnection });
  }
  await pdfQueueEvents.waitUntilReady();
  return pdfQueueEvents;
}

export class PdfQueueOverloadedError extends Error {
  constructor() {
    super("PDF_OVERLOADED");
    this.name = "PdfQueueOverloadedError";
  }
}

export async function assertPdfQueueHasCapacity(): Promise<void> {
  if (!pdfQueue) return;
  const counts = await pdfQueue.getJobCounts();
  if (counts.waiting > PDF_QUEUE_CAP_WAITING || counts.active > PDF_QUEUE_CAP_ACTIVE) {
    throw new PdfQueueOverloadedError();
  }
}

/**
 * Runs PDF generation on the worker pool. Falls back to inline when `pdfQueue` is null.
 */
export async function enqueuePdfGenerationAndWait(
  data: PdfGenerateJob,
  timeoutMs: number,
  opts?: { tier?: number }
): Promise<{ pdf: Buffer; hasQuickChart: boolean }> {
  return pdfExportCircuit.execute(async () => {
    const qe = await ensurePdfQueueEvents();
    if (!pdfQueue || !qe) {
      throw new Error("PDF queue unavailable");
    }
    await assertPdfQueueHasCapacity();
    const tier = opts?.tier ?? pdfJobTierForRole(undefined);
    const enqueuedAtMs = Date.now();
    const payload: PdfGenerateJob = {
      ...data,
      pdfRoleBase: tier,
      enqueuedAtMs
    };
    const priority = computeFairPdfQueuePriority(tier, enqueuedAtMs, enqueuedAtMs);
    const job = await pdfQueue.add("generate", payload, {
      ...defaultJobOpts,
      timeout: PDF_JOB_TIMEOUT_MS,
      priority
    } as JobsOptions);
    recordPdfEnqueueByTier(tier);
    const result = (await job.waitUntilFinished(qe, timeoutMs)) as PdfJobResult;
    if (!result?.pdfBase64 || typeof result.pdfBase64 !== "string") {
      throw new Error("PDF worker returned an invalid payload.");
    }
    return {
      pdf: Buffer.from(result.pdfBase64, "base64"),
      hasQuickChart: Boolean(result.hasQuickChart)
    };
  });
}
