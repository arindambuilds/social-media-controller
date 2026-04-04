import { Queue } from "bullmq";
import { createBullMqConnection } from "../../lib/redis";
import { queueNames } from "../../queues/queueNames";
import type { EmailJob } from "./emailTypes";

export const EMAIL_QUEUE_NAME = queueNames.email;

const emailQueueConnection = createBullMqConnection();

export const emailQueue: Queue<EmailJob> | null =
  emailQueueConnection != null
    ? new Queue<EmailJob>(EMAIL_QUEUE_NAME, {
        connection: emailQueueConnection,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 30_000 },
          removeOnComplete: { count: 500, age: 86_400 },
          removeOnFail: { count: 200, age: 604_800 }
        }
      })
    : null;
