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

export type IngestionJob = {
  socialAccountId: string;
  platform: string;
  trigger?: "manual" | "webhook" | "oauth_connect" | "scheduled";
  eventType?: "comment" | "message" | "post";
  externalId?: string;
};

/** Same work as the BullMQ worker, run in-process when Redis is unavailable. */
export async function executeIngestionJobSync(data: IngestionJob): Promise<void> {
  logger.info("Processing ingestion (inline, no Redis)", data);

  const account = await prisma.socialAccount.findUnique({
    where: { id: data.socialAccountId },
    include: {
      client: { select: { ingestionPausedUntil: true, id: true } }
    }
  });

  if (!account) {
    logger.warn("Skipping ingestion for missing social account", data);
    return;
  }

  const pausedUntil = account.client.ingestionPausedUntil;
  if (pausedUntil && pausedUntil.getTime() > Date.now()) {
    logger.warn("Skipping ingestion (client paused — likely rate limit cooldown)", {
      clientId: account.clientId,
      socialAccountId: account.id,
      ingestionPausedUntil: pausedUntil.toISOString()
    });
    return;
  }

  if (account.platform === "INSTAGRAM") {
    const result =
      env.INGESTION_MODE === "mock"
        ? await syncMockInstagramSocialAccount(account.id)
        : await syncInstagramSocialAccount(account.id);
    logger.info("Instagram ingestion completed (inline)", {
      socialAccountId: account.id,
      platform: account.platform,
      trigger: data.trigger ?? "unknown",
      ingestionMode: env.INGESTION_MODE,
      recordsFetched: result.recordsFetched
    });
    return;
  }

  logger.info("Ingestion completed (inline)", {
    socialAccountId: account.id,
    platform: account.platform
  });
}

export const ingestionQueue: Queue<IngestionJob> | null =
  redisConnection != null
    ? new Queue<IngestionJob>(queueNames.ingestion, {
        connection: redisConnection,
        defaultJobOptions: queueDefaultJobOptions
      })
    : null;

export async function addIngestionJob(
  name: string,
  data: IngestionJob,
  opts?: JobsOptions
): Promise<void> {
  if (!ingestionQueue) {
    logger.warn("[ingestion] No Redis — running inline", { name });
    await executeIngestionJobSync(data);
    return;
  }
  await ingestionQueue.add(name, data, opts);
}
