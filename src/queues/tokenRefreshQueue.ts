import { Queue } from "bullmq";
import { redisConnection } from "../lib/redis";
import { queueNames } from "./queueNames";

export type TokenRefreshJob = {
  socialAccountId: string;
};

export const tokenRefreshQueue = new Queue<TokenRefreshJob>(queueNames.tokenRefresh, {
  connection: redisConnection
});
