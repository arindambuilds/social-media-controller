import { Job, Worker } from "bullmq";
import { workerPollingOptions } from "../lib/bullmqDefaults";
import { redisConnection } from "../lib/redis";
import { logger } from "../lib/logger";
import { queueNames } from "../queues/queueNames";
import type { TokenRefreshJob } from "../queues/tokenRefreshQueue";
import { executeTokenRefreshJobSync } from "../queues/tokenRefreshQueue";

if (!redisConnection) {
  logger.error("Token refresh worker requires REDIS_URL");
  process.exit(1);
}
const redis = redisConnection;

async function processTokenRefresh(job: Job<TokenRefreshJob>) {
  await executeTokenRefreshJobSync(job.data);
}

new Worker<TokenRefreshJob>(queueNames.tokenRefresh, processTokenRefresh, {
  ...workerPollingOptions,
  connection: redis,
  concurrency: 3
});

logger.info("Token refresh worker started");
