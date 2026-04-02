import type { PulseTier } from "../config/pulseTiers";
import { CLAUDE_TIP_FALLBACK } from "./briefingAgent";
import type { BriefingData } from "./briefingData";

export function briefingTipSentence(fullBriefing: string, claudeSucceeded: boolean): string {
  if (!claudeSucceeded) return CLAUDE_TIP_FALLBACK;
  const m = fullBriefing.match(/[^\n.!?]+[.!?]?/);
  const s = (m?.[0] ?? fullBriefing).trim();
  return s.length > 280 ? `${s.slice(0, 277)}…` : s;
}

export type WhatsAppBriefingExtras = {
  upgradeLines?: string[];
  streakLine?: string | null;
  weeklyLine?: string | null;
  eliteAlertLine?: string | null;
};

function fmtInt(n: number): string {
  return Number.isFinite(n) ? n.toLocaleString("en-IN") : String(n ?? "");
}

/**
 * Tiered WhatsApp body: Normal stays short; Standard adds week context; Elite adds alerts + streak.
 */
export function buildWhatsAppBriefingBody(
  data: BriefingData,
  aiTip: string,
  tier: PulseTier = "free",
  extras?: WhatsAppBriefingExtras
): string {
  const name = data.businessName.trim() || "there";
  const newFollowers = fmtInt(data.newFollowers);
  const newLeads = fmtInt(data.newLeads);
  const likesYesterday = fmtInt(data.likesYesterday);
  const commentsYesterday = fmtInt(data.commentsYesterday);

  const lines: string[] = [`🌅 Good morning, ${name}!`, "", "YESTERDAY (IST):"];

  if (tier === "free" || tier === "normal") {
    lines.push(
      `📊 +${newFollowers} followers · 📥 ${newLeads} leads`,
      `❤️ ${likesYesterday} likes · 💬 ${commentsYesterday} comments`
    );
  } else {
    lines.push(
      `📊 +${newFollowers} followers (≈${fmtInt(data.totalFollowers)} total)`,
      `📥 ${newLeads} leads · ❤️ ${likesYesterday} likes · 💬 ${commentsYesterday} comments`
    );
    if (data.leadsLast7d != null && data.leadsPrev7d != null) {
      lines.push(
        "",
        "WEEK TREND:",
        `📈 Leads last 7d: ${fmtInt(data.leadsLast7d)} (prior 7d: ${fmtInt(data.leadsPrev7d)})`
      );
    }
    if (tier === "elite" && data.followersNet7d != null) {
      const sign = data.followersNet7d >= 0 ? "+" : "";
      lines.push(`👥 Followers (7d net): ${sign}${fmtInt(data.followersNet7d)}`);
    }
  }

  lines.push("", "INSIGHT:", aiTip);

  if (tier === "elite" && extras?.eliteAlertLine) {
    lines.push("", extras.eliteAlertLine);
  }

  if (extras?.weeklyLine) {
    lines.push("", extras.weeklyLine);
  }

  if (extras?.streakLine) {
    lines.push("", extras.streakLine);
  }

  if (extras?.upgradeLines?.length) {
    lines.push("", "—", ...extras.upgradeLines);
  }

  lines.push("", "Reply STOP to unsubscribe.", "— Pulse / Instagram Growth Copilot");

  return lines.join("\n");
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
    `New leads (yesterday): ${data.newLeads}`,
    `Likes yesterday: ${data.likesYesterday}`,
    `Comments yesterday: ${data.commentsYesterday}`,
    "",
    "Today's tip:",
    aiTip,
    "",
    fullBriefing
  ].join("\n");
}
