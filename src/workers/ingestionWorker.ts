import { Job, Worker } from "bullmq";
import { prisma } from "../lib/prisma";
import { redisConnection } from "../lib/redis";
import { logger } from "../lib/logger";
import { queueNames } from "../queues/queueNames";
import type { IngestionJob } from "../queues/ingestionQueue";
import { env } from "../config/env";
import { syncInstagramSocialAccount } from "../services/instagramIngestionService";
import { syncMockInstagramSocialAccount } from "../services/mockInstagramIngestionService";

async function processJob(job: Job<IngestionJob>) {
  logger.info("Processing ingestion job", job.data);

  const account = await prisma.socialAccount.findUnique({
    where: { id: job.data.socialAccountId }
  });

  if (!account) {
    logger.warn("Skipping ingestion job for missing social account", job.data);
    return;
  }

  if (account.platform === "INSTAGRAM") {
    const result =
      env.INGESTION_MODE === "mock"
        ? await syncMockInstagramSocialAccount(account.id)
        : await syncInstagramSocialAccount(account.id);
    logger.info("Instagram ingestion job completed", {
      socialAccountId: account.id,
      platform: account.platform,
      trigger: job.data.trigger ?? "unknown",
      ingestionMode: env.INGESTION_MODE,
      recordsFetched: result.recordsFetched
    });
    return;
  }

  logger.info("Ingestion job completed", {
    socialAccountId: account.id,
    platform: account.platform
  });
}

new Worker<IngestionJob>(queueNames.ingestion, processJob, {
  connection: redisConnection,
  concurrency: 5
});

logger.info("Ingestion worker started");
