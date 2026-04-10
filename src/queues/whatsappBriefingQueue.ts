import type { JobsOptions } from "bullmq";
import { Queue } from "bullmq";
import { redisConnection } from "../lib/redis";
import { queueNames } from "./queueNames";

/** Same shape as briefing dispatcher jobs (no payload). */
export type WhatsAppBriefingJob = Record<string, never>;

const repeatOpts: JobsOptions = {
  attempts: 3,
  backoff: { type: "fixed", delay: 60_000, jitter: 0.2 },
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 30 }
};

/** `enableOfflineQueue` is set on the shared ioredis client (`src/lib/redis.ts`), not on `Queue` opts. */
export const whatsappBriefingQueue: Queue<WhatsAppBriefingJob> | null =
  redisConnection != null
    ? new Queue<WhatsAppBriefingJob>(queueNames.whatsappBriefing, {
        connection: redisConnection,
        defaultJobOptions: { removeOnComplete: 50, removeOnFail: 20 }
      })
    : null;

/**
 * 09:00 Asia/Kolkata daily tick → `runMorningBriefingDispatchTick` (Claude + Twilio in worker).
 * Enable with `BRIEFING_DISPATCH_MODE=nine_am_ist` and start `startWhatsAppBriefingWorker()` in `server.ts`.
 * Uses `upsertJobScheduler` so maintenance worker startup is idempotent (no duplicate repeatables per deploy).
 */
export async function registerWhatsAppBriefingNineAmRepeatable(): Promise<void> {
  if (!whatsappBriefingQueue) return;
  await whatsappBriefingQueue.upsertJobScheduler(
    "whatsapp-briefing-9am-ist",
    { pattern: "0 9 * * *", tz: "Asia/Kolkata" },
    {
      name: "send-daily",
      data: {},
      opts: repeatOpts
    }
  );
}
