import { prisma } from "../lib/prisma";

export async function logAiUsage(input: {
  clientId: string;
  feature: string;
  tokensIn: number;
  tokensOut: number;
  costUsd?: number | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.aiUsageLog.create({
      data: {
        clientId: input.clientId,
        feature: input.feature,
        tokensIn: input.tokensIn,
        tokensOut: input.tokensOut,
        costUsd: input.costUsd ?? undefined,
        metadata: input.metadata ? (input.metadata as object) : undefined
      }
    });
  } catch {
    /* non-fatal */
  }
}
