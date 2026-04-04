import type { AccountVerificationEmail, EmailTemplateResult } from "../emailTypes";
import { baseLayout, escapeTemplateHtml } from "./baseLayout";

export function renderAccountVerificationTemplate(data: AccountVerificationEmail["data"]): EmailTemplateResult {
  const subject = "Verify your PulseOS account";
  const htmlBody = baseLayout({
    subject,
    previewText: `Verify your account in the next ${data.expiresInHours} hours.`,
    body: `
      <h2>Hi ${escapeTemplateHtml(data.name)},</h2>
      <p>Welcome to PulseOS. Please verify your account to activate your workspace.</p>
      <div class="panel">
        <p>Your verification link expires in <strong>${data.expiresInHours} hours</strong>.</p>
      </div>
      <p><a class="button" href="${escapeTemplateHtml(data.verificationUrl)}">Verify account</a></p>
      <p class="muted">If the button does not work, copy and paste this URL into your browser:</p>
      <p class="muted">${escapeTemplateHtml(data.verificationUrl)}</p>
    `
  });
  const textBody = [
    `Hi ${data.name},`,
    "",
    "Welcome to PulseOS. Please verify your account to activate your workspace.",
    `Verification link: ${data.verificationUrl}`,
    `This link expires in ${data.expiresInHours} hours.`
  ].join("\n");
  return { subject, htmlBody, textBody };
}
