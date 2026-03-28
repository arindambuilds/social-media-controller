import type { Job } from "bullmq";
import { Worker } from "bullmq";
import { prisma } from "../lib/prisma";
import { redisConnection } from "../lib/redis";
import { logger } from "../lib/logger";
import { queueNames } from "../queues/queueNames";
import type { PostPublishJob } from "../queues/postPublishQueue";
import {
  markScheduledPostFailed,
  markScheduledPostPublished,
  publishToFacebook,
  publishToInstagram,
  publishToLinkedIn
} from "../services/publishOutboundPost";

async function handlePublish(job: Job<PostPublishJob>): Promise<void> {
  const row = await prisma.scheduledPost.findUnique({
    where: { id: job.data.scheduledPostId },
    include: { socialAccount: true }
  });

  if (!row) {
    logger.warn("Scheduled post not found for publish job", job.data);
    return;
  }
  if (row.status === "PUBLISHED") {
    return;
  }

  const acc = row.socialAccount;
  try {
    let result: { platformPostId: string };
    if (acc.platform === "FACEBOOK") {
      result = await publishToFacebook(acc, row);
    } else if (acc.platform === "INSTAGRAM") {
      result = await publishToInstagram(acc, row);
    } else if (acc.platform === "LINKEDIN") {
      result = await publishToLinkedIn(acc, row);
    } else if (acc.platform === "TWITTER" || acc.platform === "TIKTOK") {
      await markScheduledPostFailed(row.id, "Provider not yet configured");
      logger.info("Publish skipped — provider not configured", {
        scheduledPostId: row.id,
        platform: acc.platform
      });
      return;
    } else {
      await markScheduledPostFailed(row.id, "Unsupported platform.");
      return;
    }
    await markScheduledPostPublished(row.id, result.platformPostId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markScheduledPostFailed(row.id, message);
    logger.warn("Publish job failed", { scheduledPostId: row.id, message });
  }
}

new Worker<PostPublishJob>(queueNames.postPublish, handlePublish, {
  connection: redisConnection,
  concurrency: 2
});

logger.info("Post publish worker started");
