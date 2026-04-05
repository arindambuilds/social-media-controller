"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { CssColumnBars, CssHorizontalBars, CssSparklineBars } from "../../components/charts/css-chart-primitives";
import { apiFetch, fetchMe, type AnalyticsSummary } from "../../lib/api";
import { getAccessToken } from "../../lib/auth-storage";
import { AnalyticsPageSkeleton } from "../../components/page-skeleton";
import { FormToast, type FormToastVariant } from "../../components/form-toast";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { useExportPdf } from "../../hooks/useExportPdf";
import { usePageEnter } from "../../hooks/usePageEnter";
import { useUserPlan } from "../../hooks/useUserPlan";
import { UpgradeModal } from "../../components/UpgradeModal";
import { getExperimentVariant, getStoredExperimentVariant } from "../../lib/experiment";
import { trackEvent } from "../../lib/trackEvent";

const INFO = "#3b82f6";
const TEAL = "#00d4aa";

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
      "border-blue-500/45 bg-blue-500/15 text-blue-600",
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
  const pathname = usePathname();
  const pageClassName = usePageEnter();
  const userPlan = useUserPlan();
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [hourly, setHourly] = useState<HourlyRow[]>([]);
  const [mediaTypes, setMediaTypes] = useState<MediaRow[]>([]);
  const [topPosts, setTopPosts] = useState<PostRow[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [exportLimitReached, setExportLimitReached] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [toast, setToast] = useState<{ text: string; variant: FormToastVariant } | null>(null);
  const { exportPdf, loading: exportBusy, error: exportError, clearError: clearExportError } = useExportPdf();

  const dismissToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!exportError) return;
    if (/Free plan limit reached/i.test(exportError)) {
      setExportLimitReached(true);
      setShowUpgradeModal(true);
      setToast({ text: "Free limit reached. Upgrade to continue.", variant: "error" });
    } else {
      setToast({ text: exportError, variant: "error" });
    }
    clearExportError();
  }, [exportError, clearExportError]);

  const onExportAnalytics = useCallback(async () => {
    if (!clientId || exportBusy || exportLimitReached) return;
    if (userPlan === "free") {
      const experimentName = "paywall_vs_pricing";
      const assignedBefore = getStoredExperimentVariant(experimentName);
      const variant = getExperimentVariant(experimentName);
      if (!assignedBefore) {
        trackEvent("experiment_assigned", {
          experiment: experimentName,
          variant,
          source: "analytics-export-paywall",
          feature: "pdf_export"
        });
      }
      if (variant === "A") {
        setShowUpgradeModal(true);
      } else {
        router.push("/pricing?source=analytics-export-paywall&feature=pdf_export");
      }
      return;
    }
    const ok = await exportPdf(clientId, "analytics");
    if (ok) setToast({ text: "Report exported as PDF", variant: "success" });
  }, [clientId, exportBusy, exportLimitReached, exportPdf, userPlan, router]);

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
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    (async () => {
      try {
        const me = await fetchMe();
        let cid = me.user.clientId ?? null;
        if (!cid && me.user.role === "AGENCY_ADMIN") {
          cid = "demo-client";
        }
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
    return (
      <div key={pathname} className={`page-shell ${pageClassName}`}>
        <AnalyticsPageSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div key={pathname} className={`page-shell ${pageClassName}`}>
        <section className="gradient-border p-6">
          <h2 className="text-ink font-display text-xl font-bold">Analytics</h2>
          <ErrorState message="Couldn’t load analytics" detail={error} onRetry={() => window.location.reload()} />
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
      <div key={pathname} className={`page-shell ${pageClassName}`}>
        <section className="gradient-border p-6 text-center">
          <EmptyState
            illustration="reports"
            heading="No analytics yet"
            subline="Connect your Instagram account and synced posts will start appearing here with performance insights."
            cta={{ label: "Connect in setup", onClick: () => router.push("/onboarding") }}
          />
        </section>
      </div>
    );
  }

  const lineData =
    overview?.timeSeries.points.map((pt) => ({
      ...pt,
      engagementPct: pt.engagementRate * 100
    })) ?? [];
  const followerLine =
    overview?.followerGrowth?.points.map((pt) => ({
      date: pt.date,
      followers: pt.followerCount
    })) ?? [];

  const likesByHourData =
    summary?.likesByHour?.map((row) => ({
      hour: row.hour,
      avgLikes: row.avgLikes
    })) ?? [];

  return (
    <div key={pathname} className={`page-shell ${pageClassName}`}>
      <section className="gradient-border mb-6 p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-ink font-display m-0 text-2xl font-bold tracking-tight">Analytics</h2>
          <button
            type="button"
            className="button secondary inline-flex items-center gap-2 text-sm"
            onClick={() => void onExportAnalytics()}
            disabled={exportBusy || exportLimitReached || !clientId}
          >
            {exportBusy ? "Exporting…" : "Download Report"}
          </button>
        </div>
        {clientId ? <p className="text-muted mt-2 text-sm">Client {clientId}</p> : null}
        {userPlan === "free" ? (
          <p className="text-muted mt-1 text-xs">Free plan: 5 exports/month · Watermarked</p>
        ) : null}
        {exportLimitReached ? (
          <p className="text-warning mt-1 text-xs font-semibold">Upgrade to export more reports</p>
        ) : null}
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
      <FormToast message={toast?.text ?? null} variant={toast?.variant ?? "success"} onDismiss={dismissToast} />
      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        usagePct={100}
        featureName="PDF export"
        usageText={exportLimitReached ? "You're using 5/5 free exports this month" : "Free plan: 5 exports/month · Watermarked"}
      />

      {summary ? (
        <section className="mb-6 flex flex-col gap-6">
          <div className="gradient-border p-5 md:p-6">
            <h3 className="text-ink font-display m-0 text-lg font-bold">Instagram summary (30-day sample)</h3>
            <p className="text-muted mt-2 mb-4 text-sm">
              Platform <strong className="text-ink">INSTAGRAM</strong> — metrics from synced posts and recent workspace activity once your channels are connected.
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

          {likesByHourData.length > 0 ? (
            <div className="gradient-border p-5 md:p-6">
              <h3 className="text-ink font-display m-0 text-lg font-bold">Avg likes by hour (0–23)</h3>
              <div className="mt-4 w-full">
                <CssColumnBars data={likesByHourData} xKey="hour" yKey="avgLikes" height={280} colorA={INFO} colorB={TEAL} />
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
            <div className="w-full">
              <CssSparklineBars data={followerLine} valueKey="followers" height={220} color={INFO} />
            </div>
          </div>
        ) : null}

        <div className="gradient-border p-5 md:p-6">
          <h3 className="text-ink font-display m-0 text-lg font-bold">Engagement rate over time</h3>
          <div className="mt-4 w-full">
            <CssSparklineBars data={lineData} valueKey="engagementPct" height={280} color={TEAL} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="gradient-border p-5 md:p-6">
            <h3 className="text-ink font-display m-0 text-lg font-bold">Posts by hour</h3>
            <div className="mt-4 w-full">
              <CssColumnBars data={hourly} xKey="hour" yKey="postCount" height={260} colorA={INFO} colorB={TEAL} />
            </div>
          </div>

          <div className="gradient-border p-5 md:p-6">
            <h3 className="text-ink font-display m-0 text-lg font-bold">Media type breakdown</h3>
            <div className="mt-4 w-full">
              <CssHorizontalBars data={mediaTypes} labelKey="mediaType" valueKey="postCount" height={260} colorA={TEAL} colorB={INFO} />
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
