import type { NotificationEmail, EmailTemplateResult } from "../emailTypes";
import { baseLayout, escapeTemplateHtml } from "./baseLayout";

export function renderNotificationTemplate(data: NotificationEmail["data"]): EmailTemplateResult {
  const subject = data.subject;
  const cta = data.ctaUrl
    ? `<p><a class="button" href="${escapeTemplateHtml(data.ctaUrl)}">${escapeTemplateHtml(data.ctaLabel ?? "Open PulseOS")}</a></p>`
    : "";
  const htmlBody = baseLayout({
    subject,
    previewText: data.message.slice(0, 120),
    body: `
      <h2>Hi ${escapeTemplateHtml(data.name)},</h2>
      <p>${escapeTemplateHtml(data.message).replaceAll("\n", "<br />")}</p>
      ${cta}
    `
  });
  const textBody = [`Hi ${data.name},`, "", data.message, data.ctaUrl ? `Action: ${data.ctaUrl}` : ""].filter(Boolean).join("\n");
  return { subject, htmlBody, textBody };
}
