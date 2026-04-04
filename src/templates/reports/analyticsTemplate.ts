import { sanitizeHtml } from "../../utils/sanitize";
import { renderBaseTemplate, type ReportBranding } from "./baseTemplate";
import {
  contentTypeBreakdownChart,
  engagementTrendChart,
  followerGrowthChart,
  postPerformanceChart
} from "../../utils/charts";

type Kpis = {
  followersGrowth: number;
  engagementRatePct: number;
  reach: number;
  impressions: number;
  contentPerformanceScore: number;
};

type TrendPoint = { label: string; value: number };
type TopPost = {
  title: string;
  caption: string;
  thumbnailUrl: string | null;
  likes: number;
  comments: number;
  reach: number;
};

export type AnalyticsTemplateData = {
  clientName: string;
  periodLabel: string;
  kpis: Kpis;
  followerTrend: TrendPoint[];
  engagementTrend: TrendPoint[];
  postPerformance: TrendPoint[];
  contentTypeBreakdown: TrendPoint[];
  topPosts: TopPost[];
};

type Input = {
  data: AnalyticsTemplateData;
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

function safeBrand(branding: ReportBranding): string {
  const b = branding.brandColor?.trim();
  if (b && /^#[0-9a-fA-F]{6}$/.test(b)) return b;
  return "#6366F1";
}

function growthTone(value: number): "up" | "down" | "flat" {
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "flat";
}

function indicatorToneClass(tone: "up" | "down" | "flat"): string {
  if (tone === "up") return "color:#16a34a;";
  if (tone === "down") return "color:#dc2626;";
  return "color:#64748b;";
}

function indicatorLabel(value: number, suffix = ""): string {
  if (value > 0) return `+${value.toFixed(1)}${suffix}`;
  if (value < 0) return `${value.toFixed(1)}${suffix}`;
  return `0.0${suffix}`;
}

function buildInsights(data: AnalyticsTemplateData): string[] {
  const insights: string[] = [];
  const topReach = [...data.postPerformance].sort((a, b) => b.value - a.value)[0];
  if (topReach) {
    insights.push(
      `Reach peaks around <strong>${sanitizeHtml(topReach.label)}</strong>; schedule priority posts in this window.`
    );
  }
  if (data.kpis.engagementRatePct >= 4) {
    insights.push(
      `Engagement is strong at <strong>${data.kpis.engagementRatePct.toFixed(
        1
      )}%</strong>; scale this format with higher posting consistency.`
    );
  } else {
    insights.push(
      `Engagement is at <strong>${data.kpis.engagementRatePct.toFixed(
        1
      )}%</strong>; test stronger hooks and short-form creatives.`
    );
  }

  const reels = data.contentTypeBreakdown.find((x) => /reel/i.test(x.label))?.value ?? 0;
  const staticPosts = data.contentTypeBreakdown.find((x) => /photo|static/i.test(x.label))?.value ?? 0;
  if (reels > staticPosts) {
    insights.push(
      `Video-first content is outperforming static formats; increase <strong>Reels share</strong> in the weekly mix.`
    );
  } else if (staticPosts > 0) {
    insights.push(
      `Static posts still lead output; test at least <strong>2 short videos/week</strong> for reach expansion.`
    );
  }

  const growth = growthTone(data.kpis.followersGrowth);
  if (growth === "up") {
    insights.push(`Follower growth is positive; keep momentum with predictable posting slots and faster comment replies.`);
  } else if (growth === "down") {
    insights.push(`Follower growth is declining; prioritize collaboration posts and profile CTA optimization this week.`);
  } else {
    insights.push(`Follower growth is flat; run one campaign-style content sprint to trigger new discovery.`);
  }

  return insights.slice(0, 5);
}

export function renderAnalyticsTemplate(input: Input): string {
  const { data, branding } = input;
  const brand = safeBrand(branding);
  const followerGrowthTone = growthTone(data.kpis.followersGrowth);
  const insights = buildInsights(data);

  const followerChart = followerGrowthChart(data.followerTrend, brand);
  const engagementChart = engagementTrendChart(data.engagementTrend, brand);
  const postPerfChart = postPerformanceChart(data.postPerformance, brand);
  const contentTypeChart = contentTypeBreakdownChart(data.contentTypeBreakdown);

  const contentHtml = `
    <section class="section">
      <h3 class="section-title"><span class="section-accent"></span>KPI Overview</h3>
      <div class="grid-2">
        <div class="card kpi-card">
          <div class="kpi-label">Followers Growth</div>
          <div class="kpi-value">${data.kpis.followersGrowth.toLocaleString("en-IN")}</div>
          <div class="kpi-indicator" style="${indicatorToneClass(followerGrowthTone)}">${indicatorLabel(
            Number((data.kpis.followersGrowth / Math.max(1, data.kpis.reach)) * 100),
            "%"
          )}</div>
        </div>
        <div class="card kpi-card">
          <div class="kpi-label">Engagement Rate</div>
          <div class="kpi-value">${data.kpis.engagementRatePct.toFixed(1)}%</div>
          <div class="kpi-indicator" style="${indicatorToneClass(data.kpis.engagementRatePct - 4 > 0 ? "up" : "down")}">
            ${indicatorLabel(data.kpis.engagementRatePct - 4, "pp vs baseline")}
          </div>
        </div>
        <div class="card kpi-card">
          <div class="kpi-label">Reach / Impressions</div>
          <div class="kpi-value">${Math.round(data.kpis.reach).toLocaleString("en-IN")} / ${Math.round(
            data.kpis.impressions
          ).toLocaleString("en-IN")}</div>
          <div class="kpi-indicator muted">Visibility this period</div>
        </div>
        <div class="card kpi-card">
          <div class="kpi-label">Content Performance Score</div>
          <div class="kpi-value">${Math.round(data.kpis.contentPerformanceScore)}</div>
          <div class="kpi-indicator muted">Composite engagement quality</div>
        </div>
      </div>
    </section>

    <section class="section">
      <h3 class="section-title"><span class="section-accent"></span>Trend Analysis</h3>
      <div class="grid-2">
        <div class="card chart-card">
          <p class="mini-title">Follower Growth</p>
          <img src="${followerChart}" alt="Follower growth chart" class="chart-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
          <p class="chart-caption">30-day follower movement pattern.</p>
          <div class="chart-fallback">Chart unavailable</div>
        </div>
        <div class="card chart-card">
          <p class="mini-title">Engagement Trend</p>
          <img src="${engagementChart}" alt="Engagement trend chart" class="chart-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
          <p class="chart-caption">Interaction rate trend by day.</p>
          <div class="chart-fallback">Chart unavailable</div>
        </div>
      </div>
      <div class="grid-2" style="margin-top:16px;">
        <div class="card chart-card">
          <p class="mini-title">Post Performance</p>
          <img src="${postPerfChart}" alt="Post performance chart" class="chart-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
          <p class="chart-caption">Top posts by reach.</p>
          <div class="chart-fallback">Chart unavailable</div>
        </div>
        <div class="card chart-card">
          <p class="mini-title">Content Type Breakdown</p>
          <img src="${contentTypeChart}" alt="Content type breakdown chart" class="chart-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
          <p class="chart-caption">Distribution across content formats.</p>
          <div class="chart-fallback">Chart unavailable</div>
        </div>
      </div>
    </section>

    <section class="section card insights-card">
      <h3 class="section-title" style="margin-bottom:12px;"><span class="section-accent"></span>Key Insights</h3>
      <ul style="margin:0;padding-left:18px;line-height:1.7;">
        ${insights.map((s) => `<li style="margin:0 0 6px;">${s}</li>`).join("")}
      </ul>
    </section>

    <section class="section">
      <h3 class="section-title"><span class="section-accent"></span>Top Performing Posts</h3>
      <div style="display:grid;grid-template-columns:1fr;gap:16px;">
        ${data.topPosts
          .slice(0, 3)
          .map(
            (p) => `
          <article class="card post-card">
            ${
              p.thumbnailUrl
                ? `<img src="${escapeHtml(p.thumbnailUrl)}" alt="Top post thumbnail" class="thumb" />`
                : `<div class="thumb-placeholder">No Image</div>`
            }
            <div class="post-content">
              <p class="post-caption">${sanitizeHtml(p.caption || p.title)}</p>
              <div class="post-metrics">Likes ${p.likes.toLocaleString("en-IN")} • Comments ${p.comments.toLocaleString(
                "en-IN"
              )} • Reach ${Math.round(p.reach).toLocaleString("en-IN")}</div>
            </div>
          </article>`
          )
          .join("")}
      </div>
    </section>
  `;

  return renderBaseTemplate({
    title: `${data.clientName} Analytics Report`,
    subtitle: data.periodLabel,
    branding,
    applyWatermark: input.applyWatermark,
    generatedAt: new Date(),
    contentHtml: `
      <style>
        .kpi-label { font-size:11px; color:#94a3b8; margin:0 0 8px; }
        .kpi-value { font-size:24px; font-weight:700; line-height:1.25; color:#0f172a; margin:0 0 8px; }
        .kpi-indicator { font-size:11px; font-weight:600; }
        .mini-title { margin:0 0 8px; font-size:11px; color:#94a3b8; font-weight:600; }
        .chart-card { padding:16px; }
        .chart-img { width:100%; height:220px; object-fit:contain; border:1px solid #e2e8f0; border-radius:10px; display:block; background:#fff; }
        .chart-caption { margin:8px 0 0; font-size:11px; color:#94a3b8; }
        .chart-fallback { display:none; width:100%; min-height:220px; border:1px dashed #cbd5e1; border-radius:10px; color:#94a3b8; justify-content:center; align-items:center; font-size:12px; background:#fff; }
        .insights-card { background: color-mix(in srgb, ${brand} 8%, white); border-left:4px solid ${brand}; }
        .post-card { display:flex; align-items:flex-start; gap:12px; padding:12px; }
        .thumb, .thumb-placeholder { width:64px; height:64px; border-radius:8px; object-fit:cover; flex:0 0 64px; background:#f1f5f9; }
        .thumb-placeholder { color:#94a3b8; font-size:11px; display:flex; align-items:center; justify-content:center; }
        .post-content { min-width:0; flex:1; }
        .post-caption { margin:0 0 8px; font-size:13px; line-height:1.45; color:#0f172a; max-height:38px; overflow:hidden; }
        .post-metrics { margin:0; font-size:11px; color:#475569; }
      </style>
      ${contentHtml}
    `
  });
}

