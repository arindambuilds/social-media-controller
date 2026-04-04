export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface EmailAction {
  enabled: boolean;
  type: "admin_alert" | "notification" | "system_report";
  to: string | string[];
  subject?: string;
  data: {
    title?: string;
    body: string;
    severity?: "info" | "warning" | "critical";
    metrics?: Record<string, string | number>;
  };
  attachments?: EmailAttachment[];
}

export interface OrchestrationResult {
  finalReply: string;
  stages: string[];
  metadata: {
    stages: string[];
    timing: { totalMs: number; perStageMs: Record<string, number> };
    errors: string[];
  };
  emailAction?: EmailAction;
}
