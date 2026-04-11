import { Queue } from "bullmq";
import { queueDefaultJobOptions } from "../lib/bullmqDefaults";
import { redisConnection } from "../lib/redis";
import { queueNames } from "./queueNames";

export type WhatsAppSendBriefJob = {
  phoneE164: string;
  briefingText: string;
  dateStr: string;
};

export const whatsappSendQueue: Queue<WhatsAppSendBriefJob> | null =
  redisConnection != null
    ? new Queue<WhatsAppSendBriefJob>(queueNames.whatsappSend, {
        connection: redisConnection,
        defaultJobOptions: queueDefaultJobOptions
      })
    : null;
