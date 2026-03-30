import type { JobsOptions } from "bullmq";
import { Queue } from "bullmq";
import { redisConnection } from "../lib/redis";
import { queueNames } from "./queueNames";

export type BriefingJob = { clientId: string };

const defaultJobOpts: JobsOptions = {
  attempts: 3,
  backoff: { type: "fixed", delay: 300_000 },
  removeOnComplete: { count: 500 },
  removeOnFail: { count: 200 }
};

export const briefingQueue: Queue<BriefingJob> | null =
  redisConnection != null
    ? new Queue<BriefingJob>(queueNames.briefing, { connection: redisConnection })
    : null;

export async function enqueueBriefingJob(clientId: string): Promise<void> {
  if (!briefingQueue) {
    throw new Error("briefingQueue requires REDIS_URL");
  }
  await briefingQueue.add("morning", { clientId }, defaultJobOpts);
}
