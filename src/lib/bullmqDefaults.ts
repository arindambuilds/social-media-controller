import type { JobsOptions } from "bullmq";

export const queueDefaultJobOptions: JobsOptions = {
  removeOnComplete: 50,
  removeOnFail: 100,
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 5000
  }
};

export const workerPollingOptions = {
  stalledInterval: 30_000,
  maxStalledCount: 2,
  drainDelay: 10,
  lockDuration: 30_000
} as const;
