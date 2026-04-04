import type { SystemReportEmail, EmailTemplateResult } from "../emailTypes";
import { baseLayout, escapeTemplateHtml } from "./baseLayout";

export function renderSystemReportTemplate(data: SystemReportEmail["data"]): EmailTemplateResult {
  const subject = `${data.reportTitle} — ${data.period}`;
  const metricsRows = Object.entries(data.metrics)
    .map(([label, value]) => `<tr><td>${escapeTemplateHtml(label)}</td><td>${escapeTemplateHtml(String(value))}</td></tr>`)
    .join("");
  const bodyHtml = data.htmlBody ? `<div class="panel">${data.htmlBody}</div>` : "";
  const htmlBody = baseLayout({
    subject,
    previewText: `System report for ${data.period}.`,
    body: `
      <h2>${escapeTemplateHtml(data.reportTitle)}</h2>
      <p>Reporting period: <strong>${escapeTemplateHtml(data.period)}</strong></p>
      <table class="metric-table">${metricsRows}</table>
      ${bodyHtml}
    `
  });
  const textBody = [
    data.reportTitle,
    `Period: ${data.period}`,
    "",
    ...Object.entries(data.metrics).map(([label, value]) => `${label}: ${value}`)
  ].join("\n");
  return { subject, htmlBody, textBody };
}
