import { randomUUID } from "node:crypto";
import type { JobsOptions, Job } from "bullmq";
import { createQueuedEmailLog } from "./emailLogger";
import { emailQueue } from "./emailQueue";
import { generateDeduplicationKey } from "./deduplication";

/** BullMQ job id must not contain `:` (see BullMQ docs). */
function bullMqJobIdFromDedupKey(dedupKey: string): string {
  return dedupKey.replace(/:/g, "-").slice(0, 120);
}
import type {
  AccountVerificationEmail,
  PasswordResetEmail,
  LoginAlertEmail,
  NotificationEmail,
  SystemReportEmail,
  AdminAlertEmail,
  EmailAttachment,
  EmailJob
} from "./emailTypes";

export interface EmailAttachmentInput {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

function normalizeAttachments(attachments?: EmailAttachmentInput[]): EmailAttachment[] | undefined {
  if (!attachments || attachments.length === 0) return undefined;
  return attachments.map((attachment) => ({
    Name: attachment.filename,
    Content: typeof attachment.content === "string" ? attachment.content : attachment.content.toString("base64"),
    ContentType: attachment.contentType || "application/octet-stream"
  }));
}

async function enqueueEmailJob(job: EmailJob, subject: string, opts?: JobsOptions): Promise<Job<EmailJob>> {
  if (!emailQueue) {
    throw new Error(
      "Email queue is unavailable (REDIS_URL missing or localhost). Set a non-local Redis URL to enable queue-first email."
    );
  }

  const logId = await createQueuedEmailLog({
    to: job.to,
    type: job.type,
    subject,
    userId: job.userId,
    deduplicationKey: job.deduplicationKey
  });

  const jobId = job.deduplicationKey ? bullMqJobIdFromDedupKey(job.deduplicationKey) : randomUUID();

  return emailQueue.add(job.type, { ...job, logId }, {
    jobId,
    ...opts
  });
}

export async function enqueueAccountVerification(
  to: string,
  data: AccountVerificationEmail["data"],
  userId?: string
) {
  const dedupKey = generateDeduplicationKey("account_verification", userId || to, String(Math.floor(Date.now() / 3_600_000)));
  return enqueueEmailJob({ type: "account_verification", to, userId, data, deduplicationKey: dedupKey }, "Verify your PulseOS account");
}

export async function enqueuePasswordReset(to: string, data: PasswordResetEmail["data"], userId?: string) {
  const dedupKey = generateDeduplicationKey("password_reset", userId || to, String(Math.floor(Date.now() / 3_600_000)));
  return enqueueEmailJob({ type: "password_reset", to, userId, data, deduplicationKey: dedupKey }, "Reset your PulseOS password");
}

export async function enqueueLoginAlert(to: string, data: LoginAlertEmail["data"], userId?: string) {
  const dedupKey = generateDeduplicationKey("login_alert", userId || to, String(Math.floor(Date.now() / 3_600_000)));
  return enqueueEmailJob(
    { type: "login_alert", to, userId, data, deduplicationKey: dedupKey },
    "New login to your PulseOS account",
    { priority: 1 }
  );
}

export async function enqueueNotification(
  to: string,
  data: NotificationEmail["data"],
  attachments?: EmailAttachmentInput[],
  userId?: string
) {
  return enqueueEmailJob(
    { type: "notification", to, userId, data, attachments: normalizeAttachments(attachments) },
    data.subject
  );
}

export async function enqueueSystemReport(
  to: string | string[],
  data: SystemReportEmail["data"],
  attachments?: EmailAttachmentInput[]
) {
  const recipients = Array.isArray(to) ? to : [to];
  return Promise.all(
    recipients.map((recipient) => {
      const dedupKey = generateDeduplicationKey(
        "system_report",
        `${recipient}:${data.reportTitle}`,
        new Date().toISOString().slice(0, 10)
      );
      return enqueueEmailJob(
        {
          type: "system_report",
          to: recipient,
          data,
          deduplicationKey: dedupKey,
          attachments: normalizeAttachments(attachments)
        },
        `${data.reportTitle} � ${data.period}`
      );
    })
  );
}

export async function enqueueAdminAlert(
  to: string | string[],
  data: AdminAlertEmail["data"],
  attachments?: EmailAttachmentInput[]
) {
  const recipients = Array.isArray(to) ? to : [to];
  return Promise.all(
    recipients.map((recipient) => {
      const dedupKey = generateDeduplicationKey(
        "admin_alert",
        `${recipient}:${data.severity}:${data.title}`,
        String(Math.floor(Date.now() / 3_600_000))
      );
      return enqueueEmailJob(
        {
          type: "admin_alert",
          to: recipient,
          data,
          deduplicationKey: dedupKey,
          attachments: normalizeAttachments(attachments)
        },
        `[${data.severity.toUpperCase()}] ${data.title}`,
        { priority: 1, attempts: 5 }
      );
    })
  );
}
