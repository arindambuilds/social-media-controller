import { prisma } from "../lib/prisma";
import { emailConfig } from "../config/env";
import { logger } from "../lib/logger";

export async function runLogRetention(): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - emailConfig.retentionDays);
  const deletedLogs = await prisma.emailLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  const deletedSuppressions = await prisma.emailSuppression.deleteMany({
    where: { expiresAt: { not: null, lt: new Date() } }
  });
  logger.info("[logRetention] completed", {
    deletedLogs: deletedLogs.count,
    deletedSuppressions: deletedSuppressions.count
  });
}

if (require.main === module) {
  void runLogRetention()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      logger.error("[logRetention] failed", {
        message: error instanceof Error ? error.message : String(error)
      });
      process.exit(1);
    });
}
