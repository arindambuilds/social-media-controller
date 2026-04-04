import { prisma } from "../../lib/prisma";

export async function isSuppressed(email: string): Promise<boolean> {
  const record = await prisma.emailSuppression.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, expiresAt: true }
  });

  if (!record) return false;
  if (record.expiresAt && record.expiresAt.getTime() < Date.now()) {
    await prisma.emailSuppression.delete({ where: { email: email.toLowerCase() } }).catch(() => undefined);
    return false;
  }
  return true;
}

export async function addSuppression(
  email: string,
  reason: "bounce" | "spam_complaint" | "manual",
  expiresAt?: Date
): Promise<void> {
  await prisma.emailSuppression.upsert({
    where: { email: email.toLowerCase() },
    update: { reason, expiresAt },
    create: { email: email.toLowerCase(), reason, expiresAt }
  });
}

export async function removeSuppression(email: string): Promise<void> {
  await prisma.emailSuppression.delete({ where: { email: email.toLowerCase() } }).catch(() => undefined);
}
