import {
  enqueueAdminAlert,
  enqueueNotification,
  enqueueSystemReport,
  type EmailAttachmentInput
} from "../services/email/emailService";
import type { EmailAction } from "./types";

export async function dispatchEmailFromAgent(action: EmailAction): Promise<void> {
  if (!action.enabled) return;

  const normalizedAttachments: EmailAttachmentInput[] | undefined = action.attachments?.map((attachment) => ({
    filename: attachment.filename,
    content: attachment.content,
    contentType: attachment.contentType
  }));

  switch (action.type) {
    case "admin_alert":
      await enqueueAdminAlert(action.to, {
        severity: action.data.severity || "info",
        title: action.data.title || action.subject || "Agent Alert",
        body: action.data.body
      }, normalizedAttachments);
      return;
    case "notification": {
      const recipients = Array.isArray(action.to) ? action.to : [action.to];
      await Promise.all(
        recipients.map((recipient) =>
          enqueueNotification(
            recipient,
            {
              name: "User",
              subject: action.subject || action.data.title || "Notification from Quadrapilot",
              message: action.data.body
            },
            normalizedAttachments
          )
        )
      );
      return;
    }
    case "system_report":
      await enqueueSystemReport(action.to, {
        reportTitle: action.data.title || action.subject || "Quadrapilot System Report",
        period: new Date().toISOString().slice(0, 10),
        metrics: action.data.metrics || {},
        htmlBody: action.data.body
      }, normalizedAttachments);
      return;
  }

  const exhaustiveType: never = action.type;
  throw new Error(`Unsupported email action: ${String(exhaustiveType)}`);
}
