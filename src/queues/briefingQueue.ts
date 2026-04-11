import type { JobsOptions } from "bullmq";
import { Queue } from "bullmq";
import { queueDefaultJobOptions } from "../lib/bullmqDefaults";
import { redisConnection } from "../lib/redis";
import { queueNames } from "./queueNames";

/** Per-client briefing (`morning`) or hourly IST dispatcher (`dispatch-hour`). */
export type BriefingJob = { clientId?: string };

const defaultJobOpts: JobsOptions = {
  ...queueDefaultJobOptions
};

const dispatchRepeatOpts: JobsOptions = {
  ...queueDefaultJobOptions
};

export const briefingQueue: Queue<BriefingJob> | null =
  redisConnection != null
    ? new Queue<BriefingJob>(queueNames.briefing, {
        connection: redisConnection,
        defaultJobOptions: queueDefaultJobOptions
      })
    : null;

/** When true, skip hourly `dispatch-hour` and use `whatsapp-briefing` queue at 09:00 IST instead. */
export function isBriefingNineAmDispatchMode(): boolean {
  return process.env.BRIEFING_DISPATCH_MODE?.trim() === "nine_am_ist";
}

export async function enqueueBriefingJob(clientId: string): Promise<void> {
  if (!briefingQueue) {
    throw new Error("briefingQueue requires REDIS_URL");
  }
  await briefingQueue.add("morning", { clientId }, defaultJobOpts);
}

/**
 * BullMQ 5 repeatable: every hour at :00 **Asia/Kolkata** (same as node-cron).
 * Use `tz` so the pattern is not interpreted as UTC.
 *
 * Multi-tenant: each client's `briefingHourIst` is matched inside the tick (not a single hard-coded phone).
 * For a single 09:00-only blast, set clients' `briefingHourIst` to `9` or change the pattern + query in code.
 */
export async function registerMorningBriefingDispatchRepeatable(): Promise<void> {
  if (!briefingQueue) return;
  if (isBriefingNineAmDispatchMode()) {
    return;
  }
  await briefingQueue.add(
    "dispatch-hour",
    {},
    {
      ...dispatchRepeatOpts,
      repeat: { pattern: "0 * * * *", tz: "Asia/Kolkata" },
      jobId: "repeat:briefing-dispatch-hourly-ist"
    }
  );
}
