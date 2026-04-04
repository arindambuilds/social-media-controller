import type { EmailJob, EmailTemplateResult } from "../emailTypes";
import { renderAccountVerificationTemplate } from "./accountVerification";
import { renderPasswordResetTemplate } from "./passwordReset";
import { renderLoginAlertTemplate } from "./loginAlert";
import { renderNotificationTemplate } from "./notification";
import { renderSystemReportTemplate } from "./systemReport";
import { renderAdminAlertTemplate } from "./adminAlert";

export async function renderTemplate(job: EmailJob): Promise<EmailTemplateResult> {
  switch (job.type) {
    case "account_verification":
      return renderAccountVerificationTemplate(job.data);
    case "password_reset":
      return renderPasswordResetTemplate(job.data);
    case "login_alert":
      return renderLoginAlertTemplate(job.data);
    case "notification":
      return renderNotificationTemplate(job.data);
    case "system_report":
      return renderSystemReportTemplate(job.data);
    case "admin_alert":
      return renderAdminAlertTemplate(job.data);
    default: {
      const exhaustive: never = job;
      throw new Error(`Unsupported email type: ${String(exhaustive)}`);
    }
  }
}
