import type { PasswordResetEmail, EmailTemplateResult } from "../emailTypes";
import { baseLayout, escapeTemplateHtml } from "./baseLayout";

export function renderPasswordResetTemplate(data: PasswordResetEmail["data"]): EmailTemplateResult {
  const subject = "Reset your PulseOS password";
  const contextLine = data.ipAddress ? `<p class="muted">Request IP: <code>${escapeTemplateHtml(data.ipAddress)}</code></p>` : "";
  const htmlBody = baseLayout({
    subject,
    previewText: `Your password reset link expires in ${data.expiresInMinutes} minutes.`,
    body: `
      <h2>Hi ${escapeTemplateHtml(data.name)},</h2>
      <p>We received a request to reset your password.</p>
      <div class="panel">
        <p>The reset link expires in <strong>${data.expiresInMinutes} minutes</strong>.</p>
        ${contextLine}
      </div>
      <p><a class="button" href="${escapeTemplateHtml(data.resetUrl)}">Reset password</a></p>
      <p class="muted">If you did not request this, you can ignore this email.</p>
    `
  });
  const textBody = [
    `Hi ${data.name},`,
    "",
    "We received a request to reset your password.",
    `Reset link: ${data.resetUrl}`,
    `This link expires in ${data.expiresInMinutes} minutes.`
  ].join("\n");
  return { subject, htmlBody, textBody };
}
