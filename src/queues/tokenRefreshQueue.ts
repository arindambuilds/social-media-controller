import type { JobsOptions } from "bullmq";
import { Queue } from "bullmq";
import { redisConnection } from "../lib/redis";
import { queueNames } from "./queueNames";

export type TokenRefreshJob = {
  socialAccountId: string;
  platform?: string;
};

export const tokenRefreshQueue: Queue<TokenRefreshJob> | null =
  redisConnection != null
    ? new Queue<TokenRefreshJob>(queueNames.tokenRefresh, { connection: redisConnection })
    : null;

export async function addTokenRefreshJob(
  name: string,
  data: TokenRefreshJob,
  opts?: JobsOptions
): Promise<void> {
  if (!tokenRefreshQueue) {
    console.warn(`[bullmq] Token refresh job skipped (no Redis): ${name}`);
    return;
  }
  await tokenRefreshQueue.add(name, data, opts);
}
