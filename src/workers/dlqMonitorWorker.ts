import { emailConfig } from "../config/env";
import { logger } from "../lib/logger";
import { enqueueAdminAlert } from "../services/email/emailService";
import { emailQueue } from "../services/email/emailQueue";

export async function monitorDLQ(): Promise<void> {
  if (!emailQueue) {
    logger.warn("[dlqMonitor] skipped — email queue unavailable (no REDIS_URL)");
    return;
  }
  const failed = await emailQueue.getFailed();
  if (failed.length <= emailConfig.dlqAlertThreshold) return;

  await enqueueAdminAlert(emailConfig.defaultAlertEmail, {
    severity: "warning",
    title: "Email DLQ Alert",
    body: `${failed.length} email jobs are currently in the failed set. Investigate the email worker and provider health.`
  });
}

if (require.main === module) {
  void monitorDLQ()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      logger.error("[dlqMonitor] failed", {
        message: error instanceof Error ? error.message : String(error)
      });
      process.exit(1);
    });
}
