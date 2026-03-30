"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { BarChart3 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { apiFetch, fetchMe, type AnalyticsSummary } from "../../lib/api";
import { CLIENT_ID_KEY, getStoredClientId, getStoredToken } from "../../lib/auth-storage";
import { AnalyticsPageSkeleton } from "../../components/page-skeleton";
import { FollowerGrowthChart } from "../../components/analytics/FollowerGrowthChart";
import { EngagementHeatStrip } from "../../components/analytics/EngagementHeatStrip";
import { PostGrid } from "../../components/analytics/PostGrid";
import { FollowerGrowthChart } from "../../components/analytics/FollowerGrowthChart";
import { EngagementHeatStrip } from "../../components/analytics/EngagementHeatStrip";
import { PostGrid } from "../../components/analytics/PostGrid";

const GRID_STROKE = "#1e1e2e";
const TICK_FILL = "#8b8ba0";
const PURPLE = "#6c63ff";
const TEAL = "#00d4aa";

const tickProps = { fill: TICK_FILL, fontSize: 11 };
const tickPropsSm = { fill: TICK_FILL, fontSize: 10 };
const axisLine = { stroke: GRID_STROKE };

function chartTooltipStyle(): CSSProperties {
  return {
    background: "#1e1e2e",
    border: "1px solid #2a2a38",
    borderRadius: 12,
    color: "#f0f0ff",
    fontSize: 13,
    boxShadow: "0 0 20px rgba(108, 99, 255, 0.3)"
  };
}

type Overview = {
  success: boolean;
  totalPosts: number;
  avgEngagementRate: number;
  totalReach: number;
  bestHour: number | null;
  timeSeries: { points: Array<{ date: string; engagementRate: number }> };
  followerCount?: number | null;
  instagramHandle?: string | null;
  lastSyncedAt?: string | null;
  followerGrowth?: { points: Array<{ date: string; followerCount: number }> };
  cacheHit?: boolean;
};

type HourlyRow = { hour: number; postCount: number; avgEngagementRate: number };
type MediaRow = { mediaType: string; postCount: number; avgEngagementRate: number };
type PostRow = {
  id: string;
  mediaUrl: string | null;
  captionPreview: string;
  engagementRate: number;
  reach: number;
  publishedAt: string;
};

type PostStatus = "scheduled" | "published" | "draft" | "failed";

function formatHour(h: number | null | undefined): string {
  if (h == null) return "—";
  const suffix = h >= 12 ? "PM" : "AM";
  const n = h % 12 === 0 ? 12 : h % 12;
  return `${n}:00 ${suffix}`;
}

function formatEr(r: number): string {
  return `${(r * 100).toFixed(1)}%`;
}

function statTriple(stats: unknown): { likes: number; comments: number; published: string } {
  if (!stats || typeof stats !== "object") {
    return { likes: 0, comments: 0, published: "—" };
  }
  const s = stats as { likes?: number; comments?: number; commentsCount?: number };
  const likes = typeof s.likes === "number" ? s.likes : 0;
  const comments =
    typeof s.comments === "number" ? s.comments : typeof s.commentsCount === "number" ? s.commentsCount : 0;
  return { likes, comments, published: "—" };
}

function inferPostStatus(row: PostRow): PostStatus {
  if (!row.publishedAt) return "draft";
  const d = new Date(row.publishedAt);
  if (Number.isNaN(d.getTime())) return "draft";
  if (d.getTime() > Date.now()) return "scheduled";
  return "published";
}

function StatusBadge({ status }: { status: PostStatus }) {
  const styles: Record<PostStatus, string> = {
    scheduled:
      "border-accent-purple/45 bg-accent-purple/15 text-accent-purple",
    published: "border-accent-teal/45 bg-accent-teal/15 text-accent-teal",
    draft: "border-subtle bg-surface text-muted",
    failed: "border-danger/45 bg-danger/15 text-danger"
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${styles[status]}`}
    >
      {status}
    </span>
  );
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [hourly, setHourly] = useState<HourlyRow[]>([]);
  const [mediaTypes, setMediaTypes] = useState<MediaRow[]>([]);
  const [topPosts, setTopPosts] = useState<PostRow[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);

  const load = useCallback(async (cid: string) => {
    setError("");
    const [o, h, m, p] = await Promise.all([
      apiFetch<Overview>(`/analytics/${encodeURIComponent(cid)}/overview?days=30`),
      apiFetch<{ hours: HourlyRow[] }>(`/analytics/${encodeURIComponent(cid)}/insights/hourly`),
      apiFetch<{ types: MediaRow[] }>(`/analytics/${encodeURIComponent(cid)}/insights/media-type`),
      apiFetch<{ posts: PostRow[] }>(`/analytics/${encodeURIComponent(cid)}/posts?limit=5&sort=engagement`)
    ]);
    setOverview(o);
    setHourly(h.hours ?? []);
    setMediaTypes(m.types ?? []);
    setTopPosts(p.posts ?? []);
  }, []);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    (async () => {
      try {
        let cid = getStoredClientId();
        const me = await fetchMe();
        cid = cid ?? me.user.clientId ?? null;
        if (!cid && me.user.role === "AGENCY_ADMIN") {
          cid = "demo-client";
        }
        if (cid) localStorage.setItem(CLIENT_ID_KEY, cid);
        if (!cid) {
          setError("No client ID for this account. Log in with a user that has a client assigned.");
          setLoading(false);
          return;
        }
        setClientId(cid);
        const sum = await apiFetch<AnalyticsSummary>(
          `/analytics/INSTAGRAM/${encodeURIComponent(cid)}/summary`
        );
        setSummary(sum);
        await load(cid);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    })();
  }, [router, load]);

  if (loading) {
    return <AnalyticsPageSkeleton />;
  }

  if (error) {
    return (
      <div className="page-shell">
        <section className="gradient-border p-6">
          <h2 className="text-ink font-display text-xl font-bold">Analytics</h2>
          <p className="text-error mt-3">{error}</p>
        </section>
      </div>
    );
  }

  const empty =
    overview &&
    overview.totalPosts === 0 &&
    (!summary || summary.postsAnalyzed === 0);

  if (empty) {
    return (
      <div className="page-shell">
        <section className="gradient-border p-6 text-center">
          <div
            className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full border border-subtle"
            style={{
              background: "linear-gradient(145deg, rgba(108,99,255,0.2), rgba(0,212,170,0.12))"
            }}
            aria-hidden
          >
            <BarChart3 className="text-accent-purple" size={44} strokeWidth={1.5} />
          </div>
          <h2 className="text-ink font-display text-xl font-bold">Analytics</h2>
          <p className="text-muted mx-auto mt-3 max-w-md text-sm leading-relaxed">
            No data yet — connect your Instagram account to see your analytics here.
          </p>
          <div className="mt-6">
            <Link className="button" href="/onboarding">
              Connect in setup
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const lineData =
    overview?.timeSeries.points.map((pt) => ({
      ...pt,
      engagementPct: pt.engagementRate * 100
    })) ?? [];

  return (
    <div className="page-shell">
      <section className="gradient-border mb-6 p-5 md:p-6">
        <h2 className="text-ink font-display m-0 text-2xl font-bold tracking-tight">Analytics</h2>
        {clientId ? <p className="text-muted mt-2 text-sm">Client {clientId}</p> : null}
        {overview?.instagramHandle ? (
          <p className="text-muted mt-1 text-sm">
            @{overview.instagramHandle}
            {overview.followerCount != null
              ? ` · ~${overview.followerCount.toLocaleString()} followers (snapshot)`
              : null}
            {overview.cacheHit ? " · cached overview" : null}
          </p>
        ) : null}
      </section>

      {summary ? (
        <section className="mb-6 flex flex-col gap-6">
          <div className="gradient-border p-5 md:p-6">
            <h3 className="text-ink font-display m-0 text-lg font-bold">Instagram summary (30-day sample)</h3>
            <p className="text-muted mt-2 mb-4 text-sm">
              Platform <strong className="text-ink">INSTAGRAM</strong> — metrics from synced/seeded posts (not live Meta
              unless connected).
            </p>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ["Posts analyzed", String(summary.postsAnalyzed)],
                ["Avg engagement (composite)", summary.averageEngagementRate.toFixed(2)],
                ["Best posting hour", formatHour(summary.bestPostingHour)],
                [
                  "Top caption (truncated)",
                  `${(summary.captionWinner ?? "").slice(0, 60)}${(summary.captionWinner ?? "").length > 60 ? "…" : ""}`
                ]
              ].map(([label, val]) => (
                <div
                  key={label}
                  className="rounded-xl border border-subtle bg-surface px-4 py-3"
                >
                  <div className="text-muted text-xs font-semibold uppercase tracking-wide">{label}</div>
                  <div className="text-ink mt-1 text-lg font-bold leading-snug">{val}</div>
                </div>
              ))}
            </div>
          </div>

          {summary.likesByHour && summary.likesByHour.length > 0 ? (
            <div className="gradient-border p-5 md:p-6">
              <h3 className="text-ink font-display m-0 text-lg font-bold">Avg likes by hour (0–23)</h3>
              <div className="mt-4 h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.likesByHour}>
                    <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="hour" tick={tickPropsSm} axisLine={axisLine} />
                    <YAxis tick={tickPropsSm} axisLine={axisLine} />
                    <Tooltip contentStyle={chartTooltipStyle()} />
                    <Bar dataKey="avgLikes" radius={[6, 6, 0, 0]} name="Avg likes">
                      {summary.likesByHour.map((_, i) => (
                        <Cell key={i} fill={i % 2 === 0 ? PURPLE : TEAL} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="gradient-border p-5 md:p-6">
              <h3 className="text-ink font-display m-0 text-lg font-bold">Top posts (by likes)</h3>
              <ul className="mt-4 list-none space-y-0 p-0">
                {(summary.topPosts ?? []).map((p, idx) => {
                  const st = statTriple(p.engagementStats);
                  const cap = (p.content ?? p.platformPostId ?? "").slice(0, 60);
                  const pub =
                    p.publishedAt != null
                      ? new Date(p.publishedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric"
                        })
                      : "—";
                  return (
                    <li
                      key={p.id}
                      className={`analytics-post-row border-b border-subtle py-3 text-sm ${idx % 2 === 0 ? "analytics-post-row--a" : "analytics-post-row--b"}`}
                    >
                      <div className="text-ink">
                        {cap}
                        {(p.content ?? "").length > 60 ? "…" : ""}
                      </div>
                      <div className="text-muted mt-1.5 text-xs">
                        {pub} · {st.likes} likes · {st.comments} comments
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="gradient-border p-5 md:p-6">
              <h3 className="text-ink font-display m-0 text-lg font-bold">Worst posts (by likes)</h3>
              <ul className="mt-4 list-none space-y-0 p-0">
                {(summary.worstPosts ?? []).map((p, idx) => {
                  const st = statTriple(p.engagementStats);
                  const cap = (p.content ?? p.platformPostId ?? "").slice(0, 60);
                  const pub =
                    p.publishedAt != null
                      ? new Date(p.publishedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric"
                        })
                      : "—";
                  return (
                    <li
                      key={p.id}
                      className={`analytics-post-row border-b border-subtle py-3 text-sm ${idx % 2 === 0 ? "analytics-post-row--a" : "analytics-post-row--b"}`}
                    >
                      <div className="text-ink">
                        {cap}
                        {(p.content ?? "").length > 60 ? "…" : ""}
                      </div>
                      <div className="text-muted mt-1.5 text-xs">
                        {pub} · {st.likes} likes · {st.comments} comments
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-6">
        <div className="gradient-border p-5 md:p-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["Total posts", String(overview?.totalPosts ?? 0)],
              ["Avg engagement rate", formatEr(overview?.avgEngagementRate ?? 0)],
              ["Total reach", String(Math.round(overview?.totalReach ?? 0))],
              ["Best hour", formatHour(overview?.bestHour ?? null)]
            ].map(([label, val]) => (
              <div key={label} className="rounded-xl border border-subtle bg-surface px-4 py-3">
                <div className="text-muted text-xs font-semibold uppercase tracking-wide">{label}</div>
                <div className="text-ink mt-1 text-xl font-bold tabular-nums">{val}</div>
              </div>
            ))}
          </div>
        </div>

        {followerLine.length > 0 ? (
          <div className="gradient-border p-5 md:p-6">
            <h3 className="text-ink font-display m-0 text-lg font-bold">Audience snapshot (seed / sync)</h3>
            <p className="text-muted mt-2 mb-4 text-sm">
              Daily follower counts when available from ingestion or seed — not live Meta unless connected.
            </p>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={followerLine}>
                  <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={tickProps} axisLine={axisLine} />
                  <YAxis tick={tickProps} axisLine={axisLine} />
                  <Tooltip contentStyle={chartTooltipStyle()} />
                  <Line
                    type="monotone"
                    dataKey="followers"
                    stroke={PURPLE}
                    strokeWidth={2}
                    dot={false}
                    name="Followers"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}

        <div className="gradient-border p-5 md:p-6">
          <h3 className="text-ink font-display m-0 text-lg font-bold">Engagement rate over time</h3>
          <div className="mt-4 h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={tickProps} axisLine={axisLine} />
                <YAxis tick={tickProps} axisLine={axisLine} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={chartTooltipStyle()}
                  formatter={(value: number) => [`${value.toFixed(1)}%`, "Engagement"]}
                />
                <Line
                  type="monotone"
                  dataKey="engagementPct"
                  stroke={TEAL}
                  strokeWidth={2}
                  dot={false}
                  name="Engagement %"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="gradient-border p-5 md:p-6">
            <h3 className="text-ink font-display m-0 text-lg font-bold">Posts by hour</h3>
            <div className="mt-4 h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourly}>
                  <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="hour" tick={tickPropsSm} axisLine={axisLine} />
                  <YAxis tick={tickPropsSm} axisLine={axisLine} />
                  <Tooltip contentStyle={chartTooltipStyle()} />
                  <Bar dataKey="postCount" radius={[6, 6, 0, 0]} name="Posts">
                    {hourly.map((_, i) => (
                      <Cell key={i} fill={i % 2 === 0 ? PURPLE : TEAL} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="gradient-border p-5 md:p-6">
            <h3 className="text-ink font-display m-0 text-lg font-bold">Media type breakdown</h3>
            <div className="mt-4 h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mediaTypes} layout="vertical">
                  <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={tickPropsSm} axisLine={axisLine} />
                  <YAxis
                    type="category"
                    dataKey="mediaType"
                    width={72}
                    tick={tickPropsSm}
                    axisLine={axisLine}
                  />
                  <Tooltip contentStyle={chartTooltipStyle()} />
                  <Bar dataKey="postCount" radius={[0, 6, 6, 0]} name="Posts">
                    {mediaTypes.map((_, i) => (
                      <Cell key={i} fill={i % 2 === 0 ? TEAL : PURPLE} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="gradient-border overflow-hidden p-5 md:p-6">
          <h3 className="text-ink font-display m-0 text-lg font-bold">Posts performance</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="analytics-posts-table w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-subtle">
                  <th className="text-muted pb-3 pr-4 font-semibold">Preview</th>
                  <th className="text-muted pb-3 pr-4 font-semibold">Caption</th>
                  <th className="text-muted pb-3 pr-4 font-semibold">Status</th>
                  <th className="text-muted pb-3 pr-4 font-semibold">ER</th>
                  <th className="text-muted pb-3 font-semibold">Reach</th>
                </tr>
              </thead>
              <tbody>
                {topPosts.map((row) => {
                  const status = inferPostStatus(row);
                  return (
                    <tr key={row.id}>
                      <td className="py-3 pr-4 align-top">
                        {row.mediaUrl ? (
                          <img
                            src={row.mediaUrl}
                            alt=""
                            width={72}
                            height={72}
                            className="h-[72px] w-[72px] rounded-xl border border-subtle object-cover"
                          />
                        ) : (
                          <div className="h-[72px] w-[72px] rounded-xl border border-subtle bg-panel-strong" />
                        )}
                      </td>
                      <td className="text-ink max-w-[min(420px,50vw)] py-3 pr-4 align-top">
                        {row.captionPreview || "—"}
                      </td>
                      <td className="py-3 pr-4 align-middle">
                        <StatusBadge status={status} />
                      </td>
                      <td className="text-ink py-3 pr-4 align-middle tabular-nums">{formatEr(row.engagementRate)}</td>
                      <td className="text-ink py-3 align-middle tabular-nums">{Math.round(row.reach)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
