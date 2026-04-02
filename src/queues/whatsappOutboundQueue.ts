import type { JobsOptions } from "bullmq";
import { Queue } from "bullmq";
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
  /** One attempt + 3 retries. */
  attempts: 4,
  backoff: { type: "exponential", delay: 3000 },
  removeOnComplete: { count: 200 },
  removeOnFail: { count: 100 }
};

export const whatsappOutboundQueue: Queue<WhatsAppOutboundJobPayload> | null =
  redisConnection != null
    ? new Queue<WhatsAppOutboundJobPayload>(queueNames.whatsappOutbound, {
        connection: redisConnection,
        defaultJobOptions
      })
    : null;
