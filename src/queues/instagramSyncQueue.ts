import type { JobsOptions } from "bullmq";
import { Queue } from "bullmq";
import { prisma } from "../lib/prisma";
import { queueDefaultJobOptions } from "../lib/bullmqDefaults";
import { logger } from "../lib/logger";
import { env } from "../config/env";
import { redisConnection } from "../lib/redis";
import { queueNames } from "./queueNames";
import { syncInstagramSocialAccount } from "../services/instagramIngestionService";
import { syncMockInstagramSocialAccount } from "../services/mockInstagramIngestionService";

export type InstagramSyncJob = {
  socialAccountId: string;
  trigger?: "manual" | "oauth_connect" | "scheduled";
};

export async function executeInstagramSyncJobSync(job: InstagramSyncJob): Promise<void> {
  logger.info("Processing Instagram sync (inline, no Redis)", job);

  const account = await prisma.socialAccount.findUnique({ where: { id: job.socialAccountId } });
  if (!account) {
    logger.warn("Skipping Instagram sync for missing social account", job);
    return;
  }

  if (env.INGESTION_MODE === "mock") {
    await syncMockInstagramSocialAccount(account.id);
  } else {
    await syncInstagramSocialAccount(account.id);
  }
}

export const instagramSyncQueue: Queue<InstagramSyncJob> | null =
  redisConnection != null
    ? new Queue<InstagramSyncJob>(queueNames.instagramSync, {
        connection: redisConnection,
        defaultJobOptions: queueDefaultJobOptions
      })
    : null;

export async function enqueueInstagramSync(
  socialAccountId: string,
  trigger: InstagramSyncJob["trigger"] = "manual",
  opts?: JobsOptions
): Promise<void> {
  const jobData: InstagramSyncJob = { socialAccountId, trigger };
  if (!instagramSyncQueue) {
    logger.warn("[instagram-sync] No Redis — running inline", jobData);
    await executeInstagramSyncJobSync(jobData);
    return;
  }

  const defaultOpts: JobsOptions = {
    ...queueDefaultJobOptions,
    jobId: `instagram-sync:${socialAccountId}:${trigger}:${Date.now()}`
  };

  await instagramSyncQueue.add("instagram-sync", jobData, { ...defaultOpts, ...opts });
}
