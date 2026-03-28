import { Queue } from "bullmq";
import { redisConnection } from "../lib/redis";
import { queueNames } from "./queueNames";

export type PostPublishJob = {
  scheduledPostId: string;
};

export const postPublishQueue = new Queue<PostPublishJob>(queueNames.postPublish, {
  connection: redisConnection
});
