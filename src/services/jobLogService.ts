import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";

/** Best-effort Prisma writes for queue observability — swallow all errors. */
export async function jobLogMarkActive(input: {
  queue: string;
  jobId: string;
  name: string;
  data?: Record<string, unknown> | null;
  attempts: number;
}): Promise<void> {
  try {
    await prisma.jobLog.upsert({
      where: { queue_jobId: { queue: input.queue, jobId: input.jobId } },
      create: {
        queue: input.queue,
        jobId: input.jobId,
        name: input.name,
        status: "active",
        data: input.data === undefined || input.data === null ? undefined : (input.data as object),
        attempts: input.attempts
      },
      update: {
        name: input.name,
        status: "active",
        data: input.data === undefined || input.data === null ? undefined : (input.data as object),
        attempts: input.attempts
      }
    });
  } catch (e) {
    logger.warn("job_log_active_failed", { message: e instanceof Error ? e.message : String(e) });
  }
}

export async function jobLogMarkCompleted(input: {
  queue: string;
  jobId: string;
  result?: Record<string, unknown> | null;
  attempts: number;
}): Promise<void> {
  try {
    await prisma.jobLog.update({
      where: { queue_jobId: { queue: input.queue, jobId: input.jobId } },
      data: {
        status: "completed",
        result: input.result === undefined || input.result === null ? undefined : (input.result as object),
        error: null,
        attempts: input.attempts
      }
    });
  } catch (e) {
    logger.warn("job_log_completed_failed", { message: e instanceof Error ? e.message : String(e) });
  }
}

export async function jobLogMarkFailed(input: {
  queue: string;
  jobId: string;
  error: string;
  attempts: number;
}): Promise<void> {
  try {
    await prisma.jobLog.upsert({
      where: { queue_jobId: { queue: input.queue, jobId: input.jobId } },
      create: {
        queue: input.queue,
        jobId: input.jobId,
        name: "",
        status: "failed",
        error: input.error.slice(0, 8000),
        attempts: input.attempts
      },
      update: {
        status: "failed",
        error: input.error.slice(0, 8000),
        attempts: input.attempts
      }
    });
  } catch (e) {
    logger.warn("job_log_failed_failed", { message: e instanceof Error ? e.message : String(e) });
  }
}
