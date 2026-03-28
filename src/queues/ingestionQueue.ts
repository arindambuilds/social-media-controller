import type { JobsOptions } from "bullmq";
import { Queue } from "bullmq";
import { redisConnection } from "../lib/redis";
import { queueNames } from "./queueNames";

export type IngestionJob = {
  socialAccountId: string;
  platform: string;
  trigger?: "manual" | "webhook" | "oauth_connect" | "scheduled";
  eventType?: "comment" | "message" | "post";
  externalId?: string;
};

export const ingestionQueue: Queue<IngestionJob> | null =
  redisConnection != null
    ? new Queue<IngestionJob>(queueNames.ingestion, { connection: redisConnection })
    : null;

export async function addIngestionJob(
  name: string,
  data: IngestionJob,
  opts?: JobsOptions
): Promise<void> {
  if (!ingestionQueue) {
    console.warn(`[bullmq] Ingestion job skipped (no Redis): ${name}`);
    return;
  }
  await ingestionQueue.add(name, data, opts);
}
