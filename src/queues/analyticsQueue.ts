import type { JobsOptions } from "bullmq";
import { Queue } from "bullmq";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { redisConnection } from "../lib/redis";
import { queueNames } from "./queueNames";

export type AnalyticsEventJob = {
  eventType: string;
  userId?: string;
  metadata?: Record<string, any>;
  timestamp?: Date;
};

export async function executeAnalyticsEventJobSync(job: AnalyticsEventJob): Promise<void> {
  logger.info("Processing analytics event (inline, no Redis)", job);

  await prisma.analyticsEvent.create({
    data: {
      eventType: job.eventType,
      userId: job.userId,
      metadata: job.metadata,
      createdAt: job.timestamp
    }
  });

  logger.info("Analytics event persisted", {
    eventType: job.eventType,
    userId: job.userId
  });
}

export const analyticsQueue: Queue<AnalyticsEventJob> | null =
  redisConnection != null
    ? new Queue<AnalyticsEventJob>(queueNames.analytics, {
        connection: redisConnection,
        defaultJobOptions: { removeOnComplete: 50, removeOnFail: 20 }
      })
    : null;

export async function enqueueAnalyticsEvent(
  eventType: string,
  userId?: string,
  metadata?: Record<string, any>,
  opts?: JobsOptions
): Promise<void> {
  const jobData: AnalyticsEventJob = {
    eventType,
    userId,
    metadata,
    timestamp: new Date()
  };

  if (!analyticsQueue) {
    logger.warn("[analytics] No Redis — running inline", jobData);
    await executeAnalyticsEventJobSync(jobData);
    return;
  }

  const defaultOpts: JobsOptions = {
    jobId: `analytics:${eventType}:${userId || 'anonymous'}:${Date.now()}`,
    removeOnComplete: 100,
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 }
  };

  await analyticsQueue.add("analytics-event", jobData, { ...defaultOpts, ...opts });
}