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

export const whatsappBriefingQueue: Queue<WhatsAppBriefingJob> | null =
  redisConnection != null
    ? new Queue<WhatsAppBriefingJob>(queueNames.whatsappBriefing, { connection: redisConnection })
    : null;

/**
 * 09:00 Asia/Kolkata daily tick → `runMorningBriefingDispatchTick` (Claude + Twilio in worker).
 * Enable with `BRIEFING_DISPATCH_MODE=nine_am_ist` and start `startWhatsAppBriefingWorker()` in `server.ts`.
 */
export async function registerWhatsAppBriefingNineAmRepeatable(): Promise<void> {
  if (!whatsappBriefingQueue) return;
  await whatsappBriefingQueue.add(
    "send-daily",
    {},
    {
      ...repeatOpts,
      repeat: { pattern: "0 9 * * *", tz: "Asia/Kolkata" },
      jobId: "repeat:whatsapp-briefing-9am-ist"
    }
  );
}
