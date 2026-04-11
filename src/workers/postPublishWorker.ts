import type { Job } from "bullmq";
import { Worker } from "bullmq";
import { workerPollingOptions } from "../lib/bullmqDefaults";
import { redisConnection } from "../lib/redis";
import { logger } from "../lib/logger";
import { queueNames } from "../queues/queueNames";
import type { PostPublishJob } from "../queues/postPublishQueue";
import { executePostPublishJobSync } from "../queues/postPublishQueue";

if (!redisConnection) {
  logger.error("Post publish worker requires REDIS_URL");
  process.exit(1);
}
const redis = redisConnection;

async function handlePublish(job: Job<PostPublishJob>): Promise<void> {
  await executePostPublishJobSync(job.data.scheduledPostId);
}

new Worker<PostPublishJob>(queueNames.postPublish, handlePublish, {
  ...workerPollingOptions,
  connection: redis,
  concurrency: 2
});

logger.info("Post publish worker started");
