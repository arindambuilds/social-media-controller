"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { apiFetch, fetchMe } from "../../lib/api";
import { useAuth } from "../../context/auth-context";
import { CLIENT_ID_KEY, getStoredClientId } from "../../lib/auth-storage";
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

export default function DashboardHomePage() {
  const router = useRouter();
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
        if (me.user.clientId) {
          const cid = me.user.clientId;
          localStorage.setItem(CLIENT_ID_KEY, cid);
          setClientLabel(cid);
          setStatsLoading(true);
          try {
            const [o, leadsRes, insightRes] = await Promise.all([
              apiFetch<OverviewResponse>(
                `/analytics/${encodeURIComponent(cid)}/overview?days=30`
              ),
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
            setAvgEngagementRate(
              typeof o.avgEngagementRate === "number" ? o.avgEngagementRate : null
            );
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
    return (
      <div className="page-shell">
        <div className="panel" style={{ display: "flex", justifyContent: "center", padding: 32 }}>
          <div className="spinner" aria-label="Loading" />
        </div>
        <div className="skeleton" style={{ height: 120, marginTop: 16 }} />
      </div>
    );
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
        <p className="muted" style={{ marginTop: 4, fontSize: 14 }}>
          Signed in as <strong>{email}</strong>
        </p>
      ) : null}

      {clientLabel ? (
        <section className="panel" style={{ marginTop: 20 }}>
          <div className="eyebrow">Last 30 days</div>
          {statsLoading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
              <div className="spinner" aria-label="Loading stats" />
              <span className="muted">Loading analytics…</span>
            </div>
          ) : (
            <>
              <div className="stats-grid" style={{ marginTop: 12 }}>
                <div className="stat-card">
                  <div className="muted" style={{ fontSize: 13 }}>
                    Followers
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700 }}>
                    {followerCount != null ? followerCount.toLocaleString("en-IN") : "—"}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="muted" style={{ fontSize: 13 }}>
                    Avg engagement rate
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700 }}>
                    {avgEngagementRate != null ? `${(avgEngagementRate * 100).toFixed(1)}%` : "—"}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="muted" style={{ fontSize: 13 }}>
                    Reach (approx.)
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700 }}>
                    {totalReach != null ? totalReach.toLocaleString("en-IN") : "—"}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="muted" style={{ fontSize: 13 }}>
                    Leads in pipeline
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700 }}>
                    {leadsTotal != null ? leadsTotal : "—"}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="muted" style={{ fontSize: 13 }}>
                    Best posting hour
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700 }}>{formatHour(bestHour)}</div>
                </div>
              </div>

              {insightSummary ? (
                <div
                  style={{
                    marginTop: 20,
                    padding: "16px 18px",
                    borderRadius: 12,
                    background: "var(--accent-soft)",
                    border: "1px solid var(--line)"
                  }}
                >
                  <div className="eyebrow" style={{ marginBottom: 8 }}>
                    AI insight (weekly)
                  </div>
                  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}>{insightSummary}</p>
                </div>
              ) : null}

              {followerChart.length > 1 ? (
                <div style={{ marginTop: 24 }}>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
                    Follower trend (recent days)
                  </div>
                  <div style={{ width: "100%", height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={followerChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted)" }} />
                        <YAxis
                          tick={{ fontSize: 11, fill: "var(--muted)" }}
                          width={48}
                          tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--line)",
                            borderRadius: 8
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="followers"
                          stroke="var(--accent)"
                          strokeWidth={2}
                          dot={{ r: 3, fill: "var(--accent)" }}
                          name="Followers"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : null}

              {engagementChart.length > 1 ? (
                <div style={{ marginTop: 24 }}>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
                    Engagement rate by day (%)
                  </div>
                  <div style={{ width: "100%", height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={engagementChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted)" }} />
                        <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} width={40} unit="%" />
                        <Tooltip
                          contentStyle={{
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--line)",
                            borderRadius: 8
                          }}
                          formatter={(value: number | string) => [`${value}%`, "Eng. rate"]}
                        />
                        <Line
                          type="monotone"
                          dataKey="ratePct"
                          stroke="#6366f1"
                          strokeWidth={2}
                          dot={{ r: 2, fill: "#6366f1" }}
                          name="Engagement %"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      <div
        className="panel"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 16,
          marginTop: 24
        }}
      >
        <Link className="button" href="/analytics" style={{ textAlign: "center", padding: "20px 16px" }}>
          Analytics
        </Link>
        <Link className="button" href="/insights" style={{ textAlign: "center", padding: "20px 16px" }}>
          Insights
        </Link>
        <Link className="button" href="/leads" style={{ textAlign: "center", padding: "20px 16px" }}>
          Leads
        </Link>
        <Link className="button" href="/posts" style={{ textAlign: "center", padding: "20px 16px" }}>
          Posts
        </Link>
        <Link className="button" href="/accounts" style={{ textAlign: "center", padding: "20px 16px" }}>
          Accounts
        </Link>
        <Link className="button" href="/onboarding" style={{ textAlign: "center", padding: "20px 16px" }}>
          Connect Instagram
        </Link>
      </div>

      <p className="muted" style={{ marginTop: 24, fontSize: 13 }}>
        Client ID: <code>{getStoredClientId() ?? "—"}</code>
      </p>
    </div>
  );
}
