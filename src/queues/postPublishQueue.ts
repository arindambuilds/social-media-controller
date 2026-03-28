import type { JobsOptions } from "bullmq";
import { Queue } from "bullmq";
import { redisConnection } from "../lib/redis";
import { queueNames } from "./queueNames";

export type PostPublishJob = {
  scheduledPostId: string;
};

export const postPublishQueue: Queue<PostPublishJob> | null =
  redisConnection != null
    ? new Queue<PostPublishJob>(queueNames.postPublish, { connection: redisConnection })
    : null;

export async function addPostPublishJob(
  name: string,
  data: PostPublishJob,
  opts?: JobsOptions
): Promise<void> {
  if (!postPublishQueue) {
    console.warn(`[bullmq] Post publish job skipped (no Redis): ${name}`);
    return;
  }
  await postPublishQueue.add(name, data, opts);
}
