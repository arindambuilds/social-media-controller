import { Queue } from "bullmq";
import { redisConnection } from "../lib/redis";
import { queueNames } from "./queueNames";

export type IngestionJob = {
  socialAccountId: string;
  platform: string;
};

export const ingestionQueue = new Queue<IngestionJob>(queueNames.ingestion, {
  connection: redisConnection
});
