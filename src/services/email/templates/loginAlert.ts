import type { LoginAlertEmail, EmailTemplateResult } from "../emailTypes";
import { baseLayout, escapeTemplateHtml } from "./baseLayout";

export function renderLoginAlertTemplate(data: LoginAlertEmail["data"]): EmailTemplateResult {
  const subject = "New login to your PulseOS account";
  const htmlBody = baseLayout({
    subject,
    previewText: `A new login was detected for ${data.name}.`,
    body: `
      <h2>Hi ${escapeTemplateHtml(data.name)},</h2>
      <p>We noticed a new login to your account.</p>
      <table class="metric-table">
        <tr><td>Time</td><td>${escapeTemplateHtml(data.timestamp)}</td></tr>
        <tr><td>IP address</td><td>${escapeTemplateHtml(data.ipAddress)}</td></tr>
        <tr><td>Device</td><td>${escapeTemplateHtml(data.device)}</td></tr>
        <tr><td>Location</td><td>${escapeTemplateHtml(data.location ?? "Unknown")}</td></tr>
      </table>
      <p class="muted">If this was not you, reset your password immediately.</p>
    `
  });
  const textBody = [
    `Hi ${data.name},`,
    "",
    "We noticed a new login to your account.",
    `Time: ${data.timestamp}`,
    `IP address: ${data.ipAddress}`,
    `Device: ${data.device}`,
    `Location: ${data.location ?? "Unknown"}`
  ].join("\n");
  return { subject, htmlBody, textBody };
}
