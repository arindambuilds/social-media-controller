import { Worker } from "bullmq";
import { redisConnection } from "../lib/redis";
import { logger } from "../lib/logger";

// Placeholder worker for future "publish content" automation.
// MVP: keep it running so the script doesn't fail when invoked.
new Worker(
  "post-publish",
  async (job) => {
    logger.info("post-publish job received", { name: job.name, data: job.data });
  },
  { connection: redisConnection, concurrency: 2 }
);

logger.info("Post publish worker started");

