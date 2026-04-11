import { Queue } from "bullmq";
import { queueDefaultJobOptions } from "../../lib/bullmqDefaults";
import { createBullMqConnection } from "../../lib/redis";
import { queueNames } from "../../queues/queueNames";
import type { EmailJob } from "./emailTypes";

export const EMAIL_QUEUE_NAME = queueNames.email;

const emailQueueConnection = createBullMqConnection();

export const emailQueue: Queue<EmailJob> | null =
  emailQueueConnection != null
    ? new Queue<EmailJob>(EMAIL_QUEUE_NAME, {
        connection: emailQueueConnection,
        defaultJobOptions: queueDefaultJobOptions
      })
    : null;
