import { renderBaseTemplate, type ReportBranding } from "./baseTemplate";

type Overview = {
  totalPosts: number;
  totalReach: number;
  avgEngagementRate: number;
  bestHour: number | null;
};

export type BriefingTemplateInput = {
  clientName: string;
  periodLabel: string;
  overview: Overview;
  latestBriefingText: string | null;
  branding: ReportBranding;
  applyWatermark?: boolean;
};

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function bestHourLabel(hour: number | null): string {
  if (hour == null) return "N/A";
  return `${hour}:00`;
}

export function renderBriefingTemplate(input: BriefingTemplateInput): string {
  const summary = `
    <section class="section">
      <h3 class="section-title"><span class="section-accent"></span>Performance Snapshot</h3>
      <div class="grid-2">
        <div class="card kpi-card">
          <div class="kpi-label">Total posts</div>
          <div class="kpi-value">${input.overview.totalPosts}</div>
          <div class="kpi-caption">Published in this period</div>
        </div>
        <div class="card kpi-card">
          <div class="kpi-label">Total reach</div>
          <div class="kpi-value">${Math.round(input.overview.totalReach).toLocaleString("en-IN")}</div>
          <div class="kpi-caption">Audience reached</div>
        </div>
        <div class="card kpi-card">
          <div class="kpi-label">Engagement rate</div>
          <div class="kpi-value">${(input.overview.avgEngagementRate * 100).toFixed(1)}%</div>
          <div class="kpi-caption">Overall interaction quality</div>
        </div>
        <div class="card kpi-card">
          <div class="kpi-label">Best posting hour</div>
          <div class="kpi-value">${bestHourLabel(input.overview.bestHour)}</div>
          <div class="kpi-caption">Highest response window</div>
        </div>
      </div>
    </section>`;

  const briefing = `
    <section class="section">
      <h3 class="section-title"><span class="section-accent"></span>Latest AI Briefing</h3>
      <article class="card" style="padding:16px;">
      <p style="white-space:pre-wrap;line-height:1.7;font-size:13px;margin:0;color:#0f172a;">
        ${escapeHtml(input.latestBriefingText ?? "No briefing generated yet for this client.")}
      </p>
      </article>
    </section>`;

  return renderBaseTemplate({
    title: `${input.clientName} Growth Report`,
    subtitle: input.periodLabel,
    generatedAt: new Date(),
    branding: input.branding,
    applyWatermark: input.applyWatermark,
    contentHtml: `
      <style>
        .kpi-card { padding:16px; }
        .kpi-label { font-size:11px; color:#94a3b8; margin:0 0 8px; }
        .kpi-value { font-size:24px; line-height:1.25; font-weight:700; color:#0f172a; margin:0 0 8px; }
        .kpi-caption { font-size:11px; color:#475569; margin:0; }
      </style>
      ${summary}${briefing}
    `
  });
}

