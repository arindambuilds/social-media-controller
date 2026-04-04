import { Job, Worker } from "bullmq";
import type { EmailProvider } from "./providers/types";
import { emailConfig } from "../../config/env";
import { logger } from "../../lib/logger";
import { createBullMqConnection } from "../../lib/redis";
import { renderTemplate } from "./templates/renderer";
import { markEmailSending, updateEmailStatus } from "./emailLogger";
import { EmailRateLimiter } from "./rateLimiter";
import { isDuplicate } from "./deduplication";
import { addSuppression, isSuppressed } from "./suppression";
import { createPrimaryProvider, createSecondaryProvider } from "./providers";
import { EMAIL_QUEUE_NAME } from "./emailQueue";
import type { EmailJob } from "./emailTypes";

const rateLimiter = new EmailRateLimiter(emailConfig.rateLimitPerHour, emailConfig.rateLimitPerDay);

let primaryProviderInstance: EmailProvider | null = null;
let secondaryProviderInstance: EmailProvider | null | undefined;

function getPrimaryProvider(): EmailProvider {
  if (!primaryProviderInstance) {
    primaryProviderInstance = createPrimaryProvider();
  }
  return primaryProviderInstance;
}

function getSecondaryProvider(): EmailProvider | null {
  if (secondaryProviderInstance === undefined) {
    secondaryProviderInstance = createSecondaryProvider();
  }
  return secondaryProviderInstance;
}

async function processEmailJob(job: Job<EmailJob>): Promise<void> {
  const { to, type, deduplicationKey, attachments, logId } = job.data;
  const recipient = emailConfig.devIntercept || to;

  if (await isSuppressed(recipient)) {
    await updateEmailStatus(logId, "FAILED", {
      errorCode: "SUPPRESSED",
      errorMessage: `Recipient ${recipient} is suppressed.`,
      suppressionReason: "manual"
    });
    return;
  }

  const rateCheck = await rateLimiter.canSend(recipient);
  if (!rateCheck.allowed) {
    await updateEmailStatus(logId, "FAILED", {
      errorCode: "RATE_LIMITED",
      errorMessage: `Recipient ${recipient} exceeded rate limit.`
    });
    throw new Error(`Rate limit reached for ${recipient}. Retry after ${rateCheck.retryAfterMs ?? 0}ms.`);
  }

  if (deduplicationKey && (await isDuplicate(deduplicationKey, emailConfig.dedupeTtlSeconds))) {
    await updateEmailStatus(logId, "FAILED", {
      errorCode: "DUPLICATE",
      errorMessage: `Duplicate email prevented for ${deduplicationKey}.`
    });
    return;
  }

  const rendered = await renderTemplate(job.data);
  await markEmailSending(logId);

  const providerRequest = {
    to: recipient,
    from: emailConfig.fromAddress,
    fromName: emailConfig.fromName,
    subject: rendered.subject,
    htmlBody: rendered.htmlBody,
    textBody: rendered.textBody,
    replyTo: emailConfig.replyTo,
    tags: [type],
    messageStream: type === "notification" || type === "system_report" ? "broadcasts" : "outbound",
    attachments
  };

  const primaryProvider = getPrimaryProvider();
  let providerUsed = primaryProvider.getProviderName();
  let sendResult = await primaryProvider.send(providerRequest);

  const secondaryProvider = getSecondaryProvider();
  if (!sendResult.success && secondaryProvider) {
    logger.warn("Primary email provider failed; attempting SES failover", {
      provider: primaryProvider.getProviderName(),
      error: sendResult.error,
      queue: EMAIL_QUEUE_NAME,
      jobId: job.id
    });
    providerUsed = secondaryProvider.getProviderName();
    sendResult = await secondaryProvider.send(providerRequest);
  }

  if (!sendResult.success) {
    await updateEmailStatus(logId, "FAILED", {
      providerUsed,
      errorCode: "PROVIDER_FAILURE",
      errorMessage: sendResult.error,
      providerResponse: sendResult.rawResponse
    });
    throw new Error(sendResult.error || "All email providers failed.");
  }

  await updateEmailStatus(logId, "SENT", {
    providerMessageId: sendResult.providerMessageId,
    providerUsed,
    providerResponse: sendResult.rawResponse
  });
}

export function startEmailWorker(): Worker<EmailJob> {
  const conn = createBullMqConnection();
  if (!conn) {
    throw new Error("Email worker requires REDIS_URL (non-localhost).");
  }

  const worker = new Worker<EmailJob>(EMAIL_QUEUE_NAME, processEmailJob, {
    connection: conn,
    concurrency: emailConfig.concurrency
  });

  worker.on("completed", (completedJob) => {
    logger.info("Email job completed", { queue: EMAIL_QUEUE_NAME, jobId: completedJob.id, name: completedJob.name });
  });

  worker.on("failed", (failedJob, error) => {
    logger.error("Email job failed", {
      queue: EMAIL_QUEUE_NAME,
      jobId: failedJob?.id,
      name: failedJob?.name,
      message: error.message
    });
  });

  logger.info("Email worker started", { queue: EMAIL_QUEUE_NAME, concurrency: emailConfig.concurrency });
  return worker;
}

export async function closeEmailWorker(worker: Worker<EmailJob>): Promise<void> {
  await worker.close();
}

export async function recordBounceSuppression(email: string, reason: "bounce" | "spam_complaint"): Promise<void> {
  await addSuppression(email, reason);
}
