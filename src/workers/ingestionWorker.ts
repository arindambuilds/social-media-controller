import { Job, Worker } from "bullmq";
import { prisma } from "../lib/prisma";
import { redisConnection } from "../lib/redis";
import { logger } from "../lib/logger";
import { queueNames } from "../queues/queueNames";
import type { IngestionJob } from "../queues/ingestionQueue";

async function processJob(job: Job<IngestionJob>) {
  logger.info("Processing ingestion job", job.data);

  const account = await prisma.socialAccount.findUnique({
    where: { id: job.data.socialAccountId }
  });

  if (!account) {
    logger.warn("Skipping ingestion job for missing social account", job.data);
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
