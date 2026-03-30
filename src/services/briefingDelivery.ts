import { CLAUDE_TIP_FALLBACK } from "./briefingAgent";
import type { BriefingData } from "./briefingData";

export function briefingTipSentence(fullBriefing: string, claudeSucceeded: boolean): string {
  if (!claudeSucceeded) return CLAUDE_TIP_FALLBACK;
  const m = fullBriefing.match(/[^\n.!?]+[.!?]?/);
  const s = (m?.[0] ?? fullBriefing).trim();
  return s.length > 280 ? `${s.slice(0, 277)}…` : s;
}

export function buildWhatsAppBriefingBody(
  data: BriefingData,
  aiTip: string
): string {
  const name = data.businessName.trim() || "there";
  const newFollowers = Number.isFinite(data.newFollowers)
    ? data.newFollowers.toLocaleString("en-IN")
    : String(data.newFollowers ?? "");
  const likesYesterday = Number.isFinite(data.likesYesterday)
    ? data.likesYesterday.toLocaleString("en-IN")
    : String(data.likesYesterday ?? "");
  const commentsYesterday = Number.isFinite(data.commentsYesterday)
    ? data.commentsYesterday.toLocaleString("en-IN")
    : String(data.commentsYesterday ?? "");
  return [
    `🌅 Good Morning ${name}!`,
    "",
    "YOUR INSTAGRAM TODAY:",
    `📊 ${newFollowers} new followers`,
    `❤️ ${likesYesterday} likes yesterday`,
    `💬 ${commentsYesterday} comments`,
    "",
    "TODAY'S AI TIP:",
    aiTip,
    "",
    "Reply STOP to unsubscribe.",
    "— Instagram Growth Copilot"
  ].join("\n");
}

export function buildBriefingEmailSubject(businessName: string): string {
  const n = businessName.trim() || "Your business";
  return `📊 ${n} — Your Instagram Morning Briefing`;
}

export function buildBriefingEmailHtml(params: {
  businessName: string;
  newFollowers: number;
  likesYesterday: number;
  commentsYesterday: number;
  aiTip: string;
  fullBriefingHtml: string;
  unsubscribeUrl: string;
  dashboardUrl: string;
}): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const { businessName, newFollowers, likesYesterday, commentsYesterday, aiTip, fullBriefingHtml, unsubscribeUrl } =
    params;
  const heading = esc(businessName.trim() || "Your business");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Morning briefing</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
          <tr>
            <td style="padding:28px 24px 8px;">
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#111827;">${heading}</h1>
              <p style="margin:8px 0 0;font-size:14px;color:#6b7280;">Your Instagram morning briefing</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 16px 8px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="width:33%;padding:8px;vertical-align:top;">
                    <div style="background:#f9fafb;border-radius:10px;padding:14px;text-align:center;border:1px solid #e5e7eb;">
                      <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;">Followers</div>
                      <div style="font-size:22px;font-weight:700;color:#111827;margin-top:6px;">${newFollowers}</div>
                      <div style="font-size:11px;color:#9ca3af;margin-top:4px;">new yesterday</div>
                    </div>
                  </td>
                  <td style="width:33%;padding:8px;vertical-align:top;">
                    <div style="background:#f9fafb;border-radius:10px;padding:14px;text-align:center;border:1px solid #e5e7eb;">
                      <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;">Likes</div>
                      <div style="font-size:22px;font-weight:700;color:#111827;margin-top:6px;">${likesYesterday}</div>
                      <div style="font-size:11px;color:#9ca3af;margin-top:4px;">yesterday</div>
                    </div>
                  </td>
                  <td style="width:33%;padding:8px;vertical-align:top;">
                    <div style="background:#f9fafb;border-radius:10px;padding:14px;text-align:center;border:1px solid #e5e7eb;">
                      <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;">Comments</div>
                      <div style="font-size:22px;font-weight:700;color:#111827;margin-top:6px;">${commentsYesterday}</div>
                      <div style="font-size:11px;color:#9ca3af;margin-top:4px;">yesterday</div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 24px;">
              <p style="margin:0;font-size:15px;line-height:1.55;color:#374151;font-weight:600;">Today's tip</p>
              <p style="margin:8px 0 0;font-size:15px;line-height:1.55;color:#111827;">${esc(aiTip)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 24px;">
              <div style="font-size:14px;line-height:1.55;color:#4b5563;border-top:1px solid #e5e7eb;padding-top:16px;margin-top:8px;">
                ${fullBriefingHtml}
              </div>
              <p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:#9ca3af;">
                <a href="${esc(unsubscribeUrl)}" style="color:#6b7280;">Email preferences</a>
                · Open your <a href="${esc(params.dashboardUrl)}" style="color:#6b7280;">dashboard</a> anytime.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function fullBriefingToEmailHtml(text: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return text
    .split(/\n+/)
    .filter((p) => p.trim().length > 0)
    .map((p) => `<p style="margin:0 0 12px;color:#374151;">${esc(p.trim())}</p>`)
    .join("");
}

export function briefingPlainTextFallback(
  data: BriefingData,
  aiTip: string,
  fullBriefing: string
): string {
  return [
    `${data.businessName} — Morning briefing`,
    "",
    `New followers (yesterday): ${data.newFollowers}`,
    `Likes yesterday: ${data.likesYesterday}`,
    `Comments yesterday: ${data.commentsYesterday}`,
    "",
    "Today's tip:",
    aiTip,
    "",
    fullBriefing
  ].join("\n");
}
