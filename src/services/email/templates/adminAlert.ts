import type { AdminAlertEmail, EmailTemplateResult } from "../emailTypes";
import { baseLayout, escapeTemplateHtml } from "./baseLayout";

export function renderAdminAlertTemplate(data: AdminAlertEmail["data"]): EmailTemplateResult {
  const severityLabel = data.severity.toUpperCase();
  const subject = `[${severityLabel}] ${data.title}`;
  const stack = data.stack
    ? `<div class="panel"><p><strong>Stack trace</strong></p><pre>${escapeTemplateHtml(data.stack)}</pre></div>`
    : "";
  const htmlBody = baseLayout({
    subject,
    previewText: `${severityLabel} admin alert from PulseOS.`,
    body: `
      <h2>${escapeTemplateHtml(data.title)}</h2>
      <p><strong>Severity:</strong> ${escapeTemplateHtml(severityLabel)}</p>
      <div class="panel">
        <p>${escapeTemplateHtml(data.body).replaceAll("\n", "<br />")}</p>
      </div>
      ${stack}
    `
  });
  const textBody = [subject, "", `Severity: ${severityLabel}`, data.body, data.stack ? `\n${data.stack}` : ""].filter(Boolean).join("\n");
  return { subject, htmlBody, textBody };
}
