import type { JobsOptions } from "bullmq";
import { Queue } from "bullmq";
import { queueDefaultJobOptions } from "../lib/bullmqDefaults";
import { redisConnection } from "../lib/redis";
import { queueNames } from "./queueNames";

export type WhatsAppOutboundJobPayload = {
  waId: string;
  messageType: "freeform" | "template";
  payload: Record<string, unknown>;
  contextId?: string;
  /** Until multi-tenant mapping exists, mirrors waId. */
  clientId?: string;
  correlationId?: string;
  source?: string;
};

const defaultJobOptions: JobsOptions = {
  ...queueDefaultJobOptions
};

export const whatsappOutboundQueue: Queue<WhatsAppOutboundJobPayload> | null =
  redisConnection != null
    ? new Queue<WhatsAppOutboundJobPayload>(queueNames.whatsappOutbound, {
        connection: redisConnection,
        defaultJobOptions
      })
    : null;
