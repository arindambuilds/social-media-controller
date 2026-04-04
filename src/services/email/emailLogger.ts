import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { emailConfig } from "../../config/env";
import type { EmailType } from "./emailTypes";

export type EmailDeliveryStatus = "QUEUED" | "SENDING" | "SENT" | "DELIVERED" | "BOUNCED" | "FAILED" | "SPAM_COMPLAINT";

function toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return JSON.parse(JSON.stringify({ value: String(value) })) as Prisma.InputJsonValue;
  }
}

export async function createQueuedEmailLog(input: {
  to: string;
  type: EmailType;
  subject: string;
  userId?: string;
  deduplicationKey?: string;
}): Promise<string> {
  if (!emailConfig.logsEnabled) return "noop";
  if (input.deduplicationKey) {
    const log = await prisma.emailLog.upsert({
      where: { deduplicationKey: input.deduplicationKey },
      update: {
        toAddress: input.to,
        fromAddress: emailConfig.fromAddress,
        subject: input.subject,
        emailType: input.type,
        userId: input.userId,
        status: "QUEUED"
      },
      create: {
        toAddress: input.to,
        fromAddress: emailConfig.fromAddress,
        subject: input.subject,
        emailType: input.type,
        status: "QUEUED",
        userId: input.userId,
        deduplicationKey: input.deduplicationKey
      }
    });
    return log.id;
  }

  const log = await prisma.emailLog.create({
    data: {
      toAddress: input.to,
      fromAddress: emailConfig.fromAddress,
      subject: input.subject,
      emailType: input.type,
      status: "QUEUED",
      userId: input.userId
    }
  });
  return log.id;
}

export async function markEmailSending(logId?: string): Promise<void> {
  if (!emailConfig.logsEnabled || !logId || logId === "noop") return;
  await prisma.emailLog.update({
    where: { id: logId },
    data: {
      status: "SENDING",
      lastAttemptAt: new Date()
    }
  });
}

export async function updateEmailStatus(
  logId: string | undefined,
  status: EmailDeliveryStatus,
  extra?: {
    providerMessageId?: string;
    providerUsed?: string;
    providerResponse?: unknown;
    errorCode?: string;
    errorMessage?: string;
    isBounced?: boolean;
    suppressionReason?: string;
  }
): Promise<void> {
  if (!emailConfig.logsEnabled || !logId || logId === "noop") return;
  await prisma.emailLog.update({
    where: { id: logId },
    data: {
      status,
      providerMessageId: extra?.providerMessageId,
      providerUsed: extra?.providerUsed,
      providerResponse: toJsonValue(extra?.providerResponse),
      errorCode: extra?.errorCode,
      errorMessage: extra?.errorMessage,
      isBounced: extra?.isBounced,
      suppressionReason: extra?.suppressionReason,
      lastAttemptAt: new Date(),
      attemptCount: { increment: status === "SENDING" ? 0 : 1 }
    }
  });
}
