import type { Job, Worker } from "bullmq";
import { Worker as BullWorker } from "bullmq";
import { redisConnection } from "../lib/redis";
import { logger } from "../lib/logger";
import { queueNames } from "../queues/queueNames";
import type { InstagramSyncJob } from "../queues/instagramSyncQueue";
import { executeInstagramSyncJobSync } from "../queues/instagramSyncQueue";
import { InstagramAuthError, isInstagramAuthError } from "../lib/instagramErrors";
import { prisma } from "../lib/prisma";

export function startInstagramSyncWorker(): Worker<InstagramSyncJob> | null {
  if (!redisConnection) {
    logger.error("Instagram sync worker requires REDIS_URL");
    return null;
  }

  const worker = new BullWorker<InstagramSyncJob>(queueNames.instagramSync, async (job: Job<InstagramSyncJob>) => {
    try {
      await executeInstagramSyncJobSync(job.data);
    } catch (error) {
      // Check if this is an Instagram authentication error
      if (isInstagramAuthError(error)) {
        // Mark the social account as needing re-authentication
        await prisma.socialAccount.update({
          where: { id: job.data.socialAccountId },
          data: {
            needsReauth: true,
            lastSyncedAt: new Date() // Update timestamp to indicate sync attempt
          }
        });

        // Log the auth failure with account ID for debugging
        logger.warn("Instagram authentication failed - account needs re-auth", {
          socialAccountId: job.data.socialAccountId,
          error: error.message,
          jobId: job.id
        });

        // Re-throw as InstagramAuthError for proper error classification
        throw new InstagramAuthError(
          `Instagram authentication failed for account ${job.data.socialAccountId}: ${error.message}`,
          job.data.socialAccountId
        );
      }

      // Re-throw other errors as-is
      throw error;
    }
  }, {
    connection: redisConnection,
    concurrency: 3,
    stalledInterval: 60_000,
    lockDuration: 60_000,
    lockRenewTime: 30_000,
    drainDelay: 10
  });

  worker.on("completed", (job) => {
    logger.info("Instagram sync completed", {
      jobId: job.id,
      socialAccountId: job.data.socialAccountId,
      trigger: job.data.trigger
    });
  });

  worker.on("failed", (job, err) => {
    const isAuthError = isInstagramAuthError(err);

    logger.warn("Instagram sync failed", {
      jobId: job?.id,
      socialAccountId: job?.data?.socialAccountId,
      trigger: job?.data?.trigger,
      error: err instanceof Error ? err.message : String(err),
      errorType: isAuthError ? "InstagramAuthError" : "Other",
      needsReauth: isAuthError
    });
  });

  logger.info("Instagram sync worker started");
  return worker;
}
