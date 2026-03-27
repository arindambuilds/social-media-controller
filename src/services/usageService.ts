import { prisma } from "../lib/prisma";

const MONTHLY_AI_LIMIT = 10;

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function recordAiGeneration(clientId: string): Promise<void> {
  const monthKey = currentMonthKey();
  await prisma.aiMonthlyUsage.upsert({
    where: { clientId_monthKey: { clientId, monthKey } },
    create: { clientId, monthKey, totalCount: 1 },
    update: { totalCount: { increment: 1 } }
  });
}

export async function getBillingStatus(clientId: string): Promise<{
  generationsUsed: number;
  generationsLimit: number;
}> {
  const monthKey = currentMonthKey();
  const row = await prisma.aiMonthlyUsage.findUnique({
    where: { clientId_monthKey: { clientId, monthKey } }
  });
  return {
    generationsUsed: Math.min(MONTHLY_AI_LIMIT, row?.totalCount ?? 0),
    generationsLimit: MONTHLY_AI_LIMIT
  };
}
