import { Job, Worker } from "bullmq";
import { redisConnection } from "../lib/redis";
import { logger } from "../lib/logger";
import { queueNames } from "../queues/queueNames";
import type { IngestionJob } from "../queues/ingestionQueue";
import { executeIngestionJobSync } from "../queues/ingestionQueue";

if (!redisConnection) {
  logger.error("Ingestion worker requires REDIS_URL");
  process.exit(1);
}
const redis = redisConnection;

async function processJob(job: Job<IngestionJob>) {
  await executeIngestionJobSync(job.data);
}

new Worker<IngestionJob>(queueNames.ingestion, processJob, {
  connection: redis,
  concurrency: 5,
  stalledInterval: 60_000,
  lockDuration: 60_000,
  lockRenewTime: 30_000,
  drainDelay: 10
});

logger.info("Ingestion worker started");
