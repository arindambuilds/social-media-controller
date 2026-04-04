export type EmailType =
  | "account_verification"
  | "password_reset"
  | "login_alert"
  | "notification"
  | "system_report"
  | "admin_alert";

export type EmailAttachment = {
  Name: string;
  Content: string;
  ContentType: string;
};

export interface BaseEmailJob {
  type: EmailType;
  to: string;
  userId?: string;
  logId?: string;
  deduplicationKey?: string;
  attachments?: EmailAttachment[];
}

export interface AccountVerificationEmail extends BaseEmailJob {
  type: "account_verification";
  data: { name: string; verificationUrl: string; expiresInHours: number };
}

export interface PasswordResetEmail extends BaseEmailJob {
  type: "password_reset";
  data: { name: string; resetUrl: string; expiresInMinutes: number; ipAddress?: string };
}

export interface LoginAlertEmail extends BaseEmailJob {
  type: "login_alert";
  data: { name: string; ipAddress: string; device: string; timestamp: string; location?: string };
}

export interface NotificationEmail extends BaseEmailJob {
  type: "notification";
  data: { name: string; subject: string; message: string; ctaUrl?: string; ctaLabel?: string };
}

export interface SystemReportEmail extends BaseEmailJob {
  type: "system_report";
  data: {
    reportTitle: string;
    period: string;
    metrics: Record<string, string | number>;
    htmlBody?: string;
  };
}

export interface AdminAlertEmail extends BaseEmailJob {
  type: "admin_alert";
  data: { severity: "info" | "warning" | "critical"; title: string; body: string; stack?: string };
}

export type EmailJob =
  | AccountVerificationEmail
  | PasswordResetEmail
  | LoginAlertEmail
  | NotificationEmail
  | SystemReportEmail
  | AdminAlertEmail;

export type EmailTemplateResult = {
  subject: string;
  htmlBody: string;
  textBody: string;
};
