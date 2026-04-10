import type { JobsOptions } from "bullmq";
import { Queue } from "bullmq";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { redisConnection } from "../lib/redis";
import { queueNames } from "./queueNames";
import { createNotification } from "../services/notificationService";
import {
  markScheduledPostFailed,
  markScheduledPostPublished,
  publishToFacebook,
  publishToInstagram,
  publishToLinkedIn
} from "../services/publishOutboundPost";

export type PostPublishJob = {
  scheduledPostId: string;
};

export async function executePostPublishJobSync(scheduledPostId: string): Promise<void> {
  const row = await prisma.scheduledPost.findUnique({
    where: { id: scheduledPostId },
    include: { socialAccount: true, client: { select: { ownerId: true } } }
  });

  if (!row) {
    logger.warn("Scheduled post not found (inline publish)", { scheduledPostId });
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
    void createNotification(row.client.ownerId, {
      type: "post_published",
      title: "Post published",
      message: `Your scheduled post is live on ${acc.platform}.`,
      metadata: {
        scheduledPostId: row.id,
        platformPostId: result.platformPostId,
        platform: acc.platform,
        clientId: row.clientId
      }
    }).catch((e) =>
      logger.warn("[post-publish] notification create failed", {
        message: e instanceof Error ? e.message : String(e)
      })
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markScheduledPostFailed(row.id, message);
    logger.warn("Inline publish failed", { scheduledPostId: row.id, message });
  }
}

export const postPublishQueue: Queue<PostPublishJob> | null =
  redisConnection != null
    ? new Queue<PostPublishJob>(queueNames.postPublish, {
        connection: redisConnection,
        defaultJobOptions: { removeOnComplete: 50, removeOnFail: 20 }
      })
    : null;

export async function addPostPublishJob(
  name: string,
  data: PostPublishJob,
  opts?: JobsOptions
): Promise<void> {
  if (!postPublishQueue) {
    const delay = typeof opts?.delay === "number" ? opts.delay : 0;
    logger.warn("[post-publish] No Redis — running inline", { name, delay });
    if (delay > 0) {
      await new Promise((r) => setTimeout(r, delay));
    }
    await executePostPublishJobSync(data.scheduledPostId);
    return;
  }
  await postPublishQueue.add(name, data, opts);
}
