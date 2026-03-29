"use client";

import {
  Minus,
  Percent,
  Radio,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { apiFetch, fetchMe } from "../../lib/api";
import { useAuth } from "../../context/auth-context";
import { CLIENT_ID_KEY, getStoredClientId } from "../../lib/auth-storage";
import { DashboardPageSkeleton } from "../../components/page-skeleton";
import { PageHeader } from "../../components/ui/page-header";

type OverviewResponse = {
  followerCount?: number | null;
  instagramHandle?: string | null;
  avgEngagementRate?: number;
  totalReach?: number;
  bestHour?: number | null;
  timeSeries?: { points: Array<{ date: string; engagementRate: number }> };
  followerGrowth?: { points: Array<{ date: string; followerCount: number }> };
};

type LatestInsightResponse = {
  success?: boolean;
  insight?: { keyInsights?: string[]; actionsThisWeek?: string[] } | null;
};

function formatShortDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatHour(h: number | null | undefined): string {
  if (h == null) return "—";
  const suffix = h >= 12 ? "PM" : "AM";
  const n = h % 12 === 0 ? 12 : h % 12;
  return `${n} ${suffix}`;
}

function chartTooltipStyle(): CSSProperties {
  return {
    background: "#1e1e2e",
    border: "1px solid #2a2a38",
    borderRadius: 12,
    color: "#f0f0ff",
    fontSize: 13,
    boxShadow: "0 0 20px rgba(108, 99, 255, 0.25)"
  };
}

function MetricTrend({
  prev,
  curr,
  suffix = ""
}: {
  prev: number | null;
  curr: number | null;
  suffix?: string;
}) {
  if (curr == null || prev == null) {
    return (
      <span className="text-muted mt-2 inline-flex items-center gap-1 text-xs font-semibold">
        <Minus size={14} strokeWidth={2} aria-hidden />
        No comparison
      </span>
    );
  }
  if (prev === 0) {
    return (
      <span className="text-accent-teal mt-2 inline-flex items-center gap-1 text-xs font-semibold">
        <TrendingUp size={14} strokeWidth={2} aria-hidden />
        New
      </span>
    );
  }
  const delta = ((curr - prev) / Math.abs(prev)) * 100;
  const up = delta >= 0;
  return (
    <span
      className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${up ? "text-accent-teal" : "text-danger"}`}
    >
      {up ? <TrendingUp size={14} strokeWidth={2} aria-hidden /> : <TrendingDown size={14} strokeWidth={2} aria-hidden />}
      {up ? "+" : ""}
      {delta.toFixed(1)}
      {suffix}
    </span>
  );
}

function enterStyle(delayMs: number): CSSProperties {
  return {
    animationDelay: `${delayMs}ms`,
    animationFillMode: "both"
  };
}

export default function DashboardHomePage() {
  const router = useRouter();
  const chartId = useId().replace(/:/g, "");
  const fillMain = `dashFillMain-${chartId}`;
  const fillEng = `dashFillEng-${chartId}`;

  const { token, isReady } = useAuth();
  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [clientLabel, setClientLabel] = useState<string | null>(null);
  const [igConnected, setIgConnected] = useState<boolean | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  const [instagramHandle, setInstagramHandle] = useState<string | null>(null);
  const [avgEngagementRate, setAvgEngagementRate] = useState<number | null>(null);
  const [totalReach, setTotalReach] = useState<number | null>(null);
  const [bestHour, setBestHour] = useState<number | null>(null);
  const [leadsTotal, setLeadsTotal] = useState<number | null>(null);
  const [insightSummary, setInsightSummary] = useState<string | null>(null);
  const [followerChart, setFollowerChart] = useState<Array<{ label: string; followers: number }>>([]);
  const [engagementChart, setEngagementChart] = useState<
    Array<{ label: string; ratePct: number }>
  >([]);

  const followerTrendPair = useMemo(() => {
    if (followerChart.length < 2) return { prev: null as number | null, curr: null as number | null };
    const a = followerChart[followerChart.length - 2]!.followers;
    const b = followerChart[followerChart.length - 1]!.followers;
    return { prev: a, curr: b };
  }, [followerChart]);

  const engagementTrendPair = useMemo(() => {
    if (engagementChart.length < 2) return { prev: null as number | null, curr: null as number | null };
    const a = engagementChart[engagementChart.length - 2]!.ratePct;
    const b = engagementChart[engagementChart.length - 1]!.ratePct;
    return { prev: a, curr: b };
  }, [engagementChart]);

  useEffect(() => {
    if (!isReady) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    (async () => {
      try {
        const me = await fetchMe();
        setName(me.user.name ?? me.user.email);
        setEmail(me.user.email ?? null);
        let cid = me.user.clientId ?? getStoredClientId();
        if (!cid && me.user.role === "AGENCY_ADMIN") {
          cid = "demo-client";
        }
        if (cid) {
          localStorage.setItem(CLIENT_ID_KEY, cid);
          setClientLabel(cid);
          setStatsLoading(true);
          try {
            const [o, leadsRes, insightRes] = await Promise.all([
              apiFetch<OverviewResponse>(`/analytics/${encodeURIComponent(cid)}/overview?days=30`),
              apiFetch<{
                success?: boolean;
                leads?: unknown[];
                pagination?: { total?: number };
              }>(`/leads?clientId=${encodeURIComponent(cid)}&page=1&limit=100`),
              apiFetch<LatestInsightResponse>(
                `/insights/${encodeURIComponent(cid)}/content-performance/latest`
              ).catch(() => ({ insight: null }))
            ]);
            setFollowerCount(o.followerCount ?? null);
            setInstagramHandle(o.instagramHandle ?? null);
            setAvgEngagementRate(typeof o.avgEngagementRate === "number" ? o.avgEngagementRate : null);
            setTotalReach(typeof o.totalReach === "number" ? o.totalReach : null);
            setBestHour(typeof o.bestHour === "number" ? o.bestHour : null);

            const fg = o.followerGrowth?.points ?? [];
            setFollowerChart(
              [...fg]
                .reverse()
                .slice(-14)
                .map((p) => ({
                  label: formatShortDate(p.date),
                  followers: p.followerCount
                }))
            );

            const ts = o.timeSeries?.points ?? [];
            setEngagementChart(
              ts.slice(-14).map((p) => ({
                label: formatShortDate(p.date),
                ratePct: Math.round((p.engagementRate ?? 0) * 1000) / 10
              }))
            );

            const pTotal = leadsRes.pagination?.total;
            setLeadsTotal(
              typeof pTotal === "number"
                ? pTotal
                : Array.isArray(leadsRes.leads)
                  ? leadsRes.leads.length
                  : null
            );

            const keys = insightRes.insight?.keyInsights ?? [];
            setInsightSummary(keys[0] ?? insightRes.insight?.actionsThisWeek?.[0] ?? null);
          } finally {
            setStatsLoading(false);
          }
        } else {
          setClientLabel(null);
          setFollowerCount(null);
          setInstagramHandle(null);
          setAvgEngagementRate(null);
          setTotalReach(null);
          setBestHour(null);
          setLeadsTotal(null);
          setInsightSummary(null);
          setFollowerChart([]);
          setEngagementChart([]);
        }
        setIgConnected(me.instagramConnected);
      } catch {
        /* 401 → apiFetch redirects to login; transient errors keep shell */
      }
    })();
  }, [isReady, token, router]);

  if (!isReady || !token) {
    return <DashboardPageSkeleton />;
  }

  const handleLabel = instagramHandle ? `@${instagramHandle.replace(/^@/, "")}` : null;

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Dashboard"
        title={name ? `Hi, ${name}` : "Welcome"}
        description={
          clientLabel
            ? [
                handleLabel && `Instagram ${handleLabel}`,
                igConnected != null && (igConnected ? "Account linked" : "Connect in Accounts or Onboarding"),
                "Arома Silk House demo — saree & ethnic wear, Bhubaneswar (seeded data)."
              ]
                .filter(Boolean)
                .join(" · ")
            : "Agency view — open Analytics and pick a client, or assign a client to your user."
        }
      />

      {email ? (
        <p className="text-muted mt-1 text-sm">
          Signed in as <strong className="text-ink font-semibold">{email}</strong>
        </p>
      ) : null}

      {clientLabel ? (
        <section className="mt-6">
          <div className="text-accent-purple mb-3 text-[0.6875rem] font-bold uppercase tracking-[0.16em]">
            Last 30 days
          </div>

          {statsLoading ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="gradient-border p-5">
                  <div className="skeleton skeleton-stat min-h-[120px]" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div
                  className="gradient-border animate-fade-in animate-slide-up opacity-0 p-5"
                  style={enterStyle(0)}
                >
                  <div className="relative overflow-hidden rounded-[18px] bg-[linear-gradient(165deg,rgba(108,99,255,0.12),transparent_55%)]">
                    <Users
                      className="text-accent-purple mb-3"
                      size={22}
                      strokeWidth={2}
                      aria-hidden
                    />
                    <div className="text-muted text-xs font-semibold uppercase tracking-wide">Followers</div>
                    <div className="text-ink mt-1 text-3xl font-bold tabular-nums tracking-tight">
                      {followerCount != null ? followerCount.toLocaleString("en-IN") : "—"}
                    </div>
                    <MetricTrend prev={followerTrendPair.prev} curr={followerTrendPair.curr} />
                  </div>
                </div>

                <div
                  className="gradient-border animate-fade-in animate-slide-up opacity-0 p-5"
                  style={enterStyle(70)}
                >
                  <div className="relative overflow-hidden rounded-[18px] bg-[linear-gradient(165deg,rgba(0,212,170,0.1),transparent_55%)]">
                    <Percent
                      className="text-accent-teal mb-3"
                      size={22}
                      strokeWidth={2}
                      aria-hidden
                    />
                    <div className="text-muted text-xs font-semibold uppercase tracking-wide">Engagement</div>
                    <div className="text-ink mt-1 text-3xl font-bold tabular-nums tracking-tight">
                      {avgEngagementRate != null ? `${(avgEngagementRate * 100).toFixed(1)}%` : "—"}
                    </div>
                    <MetricTrend
                      prev={engagementTrendPair.prev}
                      curr={engagementTrendPair.curr}
                      suffix="%"
                    />
                  </div>
                </div>

                <div
                  className="gradient-border animate-fade-in animate-slide-up opacity-0 p-5"
                  style={enterStyle(140)}
                >
                  <div className="relative overflow-hidden rounded-[18px] bg-[linear-gradient(165deg,rgba(108,99,255,0.1),transparent_55%)]">
                    <Radio className="text-accent-purple mb-3" size={22} strokeWidth={2} aria-hidden />
                    <div className="text-muted text-xs font-semibold uppercase tracking-wide">Reach</div>
                    <div className="text-ink mt-1 text-3xl font-bold tabular-nums tracking-tight">
                      {totalReach != null ? totalReach.toLocaleString("en-IN") : "—"}
                    </div>
                    <MetricTrend prev={null} curr={null} />
                  </div>
                </div>

                <div
                  className="gradient-border animate-fade-in animate-slide-up opacity-0 p-5"
                  style={enterStyle(210)}
                >
                  <div className="relative overflow-hidden rounded-[18px] bg-[linear-gradient(165deg,rgba(0,212,170,0.12),transparent_55%)]">
                    <UserPlus className="text-accent-teal mb-3" size={22} strokeWidth={2} aria-hidden />
                    <div className="text-muted text-xs font-semibold uppercase tracking-wide">Leads</div>
                    <div className="text-ink mt-1 text-3xl font-bold tabular-nums tracking-tight">
                      {leadsTotal != null ? leadsTotal : "—"}
                    </div>
                    <MetricTrend prev={null} curr={null} />
                  </div>
                </div>
              </div>

              {bestHour != null ? (
                <p className="text-muted mt-4 text-sm">
                  <span className="text-ink font-semibold">Best posting hour:</span> {formatHour(bestHour)}
                </p>
              ) : null}

              {insightSummary ? (
                <div
                  className="gradient-border animate-fade-in animate-slide-up opacity-0 mt-6 p-5 md:p-6"
                  style={enterStyle(280)}
                >
                  <div className="rounded-[18px] bg-surface/80 px-1">
                    <div className="text-accent-purple mb-2 text-[0.6875rem] font-bold uppercase tracking-[0.16em]">
                      AI insight (weekly)
                    </div>
                    <p className="text-ink m-0 text-base leading-relaxed">{insightSummary}</p>
                  </div>
                </div>
              ) : null}

              {followerChart.length > 1 ? (
                <div
                  className="gradient-border animate-fade-in animate-slide-up opacity-0 mt-6 p-4 md:p-6"
                  style={enterStyle(320)}
                >
                  <div className="text-muted mb-3 text-sm font-medium">Follower trend</div>
                  <div className="text-ink h-[240px] w-full md:h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={followerChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id={fillMain} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6c63ff" stopOpacity={0.45} />
                            <stop offset="100%" stopColor="#00d4aa" stopOpacity={0.06} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8b8ba0" }} axisLine={{ stroke: "#1e1e2e" }} />
                        <YAxis
                          tick={{ fontSize: 11, fill: "#8b8ba0" }}
                          width={48}
                          axisLine={{ stroke: "#1e1e2e" }}
                          tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
                        />
                        <Tooltip contentStyle={chartTooltipStyle()} />
                        <Area
                          type="monotone"
                          dataKey="followers"
                          stroke="#6c63ff"
                          strokeWidth={2}
                          fill={`url(#${fillMain})`}
                          name="Followers"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : null}

              {engagementChart.length > 1 ? (
                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div
                    className="gradient-border animate-fade-in animate-slide-up opacity-0 p-4 md:p-5"
                    style={enterStyle(380)}
                  >
                    <div className="text-muted mb-2 text-sm font-medium">Engagement rate (%)</div>
                    <div className="h-[200px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={engagementChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id={fillEng} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#00d4aa" stopOpacity={0.35} />
                              <stop offset="100%" stopColor="#6c63ff" stopOpacity={0.06} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8b8ba0" }} axisLine={{ stroke: "#1e1e2e" }} />
                          <YAxis
                            tick={{ fontSize: 11, fill: "#8b8ba0" }}
                            width={40}
                            axisLine={{ stroke: "#1e1e2e" }}
                            unit="%"
                          />
                          <Tooltip
                            contentStyle={chartTooltipStyle()}
                            formatter={(value: number | string) => [`${value}%`, "Eng. rate"]}
                          />
                          <Area
                            type="monotone"
                            dataKey="ratePct"
                            stroke="#00d4aa"
                            strokeWidth={2}
                            fill={`url(#${fillEng})`}
                            name="Engagement %"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      <div
        className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
        style={enterStyle(clientLabel ? 420 : 0)}
      >
        {(
          [
            ["/analytics", "Analytics"],
            ["/insights", "Insights"],
            ["/leads", "Leads"],
            ["/posts", "Posts"],
            ["/accounts", "Accounts"],
            ["/onboarding", "Connect Instagram"]
          ] as const
        ).map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="rounded-xl border border-subtle bg-surface px-4 py-5 text-center text-sm font-bold text-ink transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-purple/40 hover:shadow-glow"
          >
            {label}
          </Link>
        ))}
      </div>

      <p className="text-muted mt-8 text-xs">
        Client ID: <code className="text-ink bg-surface rounded px-1.5 py-0.5">{getStoredClientId() ?? "—"}</code>
      </p>
    </div>
  );
}
