"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
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

function formatHour(h: number | null): string {
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
        <section className="panel span-12">
          <h2>Analytics</h2>
          <p className="text-error">{error}</p>
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
        <section className="panel span-12">
          <h2>Analytics</h2>
          <p className="muted">No posts synced yet — connect Instagram first.</p>
          <div className="actions" style={{ marginTop: 16 }}>
            <Link className="button" href="/onboarding">
              Go to onboarding
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

  const followerLine =
    overview?.followerGrowth?.points?.map((pt) => ({
      date: pt.date,
      followers: pt.followerCount
    })) ?? [];

  return (
    <div className="page-shell">
      <section className="panel span-12">
        <h2>Analytics</h2>
        {clientId ? <p className="muted">Client {clientId}</p> : null}
        {overview?.instagramHandle ? (
          <p className="muted">
            @{overview.instagramHandle}
            {overview.followerCount != null ? ` · ~${overview.followerCount.toLocaleString()} followers (snapshot)` : null}
            {overview.cacheHit ? " · cached overview" : null}
          </p>
        ) : null}
      </section>

      {summary ? (
        <section className="section-grid">
          <div className="panel span-12">
            <h3>Instagram summary (30-day sample)</h3>
            <p className="muted" style={{ marginBottom: 16 }}>
              Platform <strong>INSTAGRAM</strong> — metrics from synced/seeded posts (not live Meta unless connected).
            </p>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Posts analyzed</div>
                <div className="stat-value">{summary.postsAnalyzed}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Avg engagement (composite)</div>
                <div className="stat-value">{summary.averageEngagementRate.toFixed(2)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Best posting hour</div>
                <div className="stat-value">{formatHour(summary.bestPostingHour)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Top caption (truncated)</div>
                <div className="stat-value" style={{ fontSize: 14, lineHeight: 1.35 }}>
                  {(summary.captionWinner ?? "").slice(0, 60)}
                  {(summary.captionWinner ?? "").length > 60 ? "…" : ""}
                </div>
              </div>
            </div>
          </div>

          {summary.likesByHour && summary.likesByHour.length > 0 ? (
            <div className="panel span-12">
              <h3>Avg likes by hour (0–23)</h3>
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={summary.likesByHour}>
                    <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
                    <XAxis dataKey="hour" tick={{ fill: "var(--muted)", fontSize: 10 }} />
                    <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--panel)",
                        border: "1px solid var(--line)",
                        borderRadius: 12
                      }}
                    />
                    <Bar dataKey="avgLikes" fill="var(--accent)" radius={[6, 6, 0, 0]} name="Avg likes" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}

          <div className="panel span-6">
            <h3>Top posts (by likes)</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {(summary.topPosts ?? []).map((p) => {
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
                    style={{
                      padding: "12px 0",
                      borderBottom: "1px solid var(--line)",
                      fontSize: 14
                    }}
                  >
                    <div>{cap}{((p.content ?? "").length > 60 ? "…" : "")}</div>
                    <div className="muted" style={{ marginTop: 6 }}>
                      {pub} · {st.likes} likes · {st.comments} comments
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="panel span-6">
            <h3>Worst posts (by likes)</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {(summary.worstPosts ?? []).map((p) => {
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
                    style={{
                      padding: "12px 0",
                      borderBottom: "1px solid var(--line)",
                      fontSize: 14
                    }}
                  >
                    <div>{cap}{((p.content ?? "").length > 60 ? "…" : "")}</div>
                    <div className="muted" style={{ marginTop: 6 }}>
                      {pub} · {st.likes} likes · {st.comments} comments
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="section-grid">
        <div className="panel span-12">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Total posts</div>
              <div className="stat-value">{overview?.totalPosts ?? 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg engagement rate</div>
              <div className="stat-value">{formatEr(overview?.avgEngagementRate ?? 0)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total reach</div>
              <div className="stat-value">{Math.round(overview?.totalReach ?? 0)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Best hour</div>
              <div className="stat-value">{formatHour(overview?.bestHour ?? null)}</div>
            </div>
          </div>
        </div>

        {followerLine.length > 0 ? (
          <div className="panel span-12">
            <h3>Audience snapshot (seed / sync)</h3>
            <p className="muted" style={{ marginBottom: 8 }}>
              Daily follower counts when available from ingestion or seed — not live Meta unless connected.
            </p>
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <LineChart data={followerLine}>
                  <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fill: "var(--muted)", fontSize: 11 }} />
                  <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--panel)",
                      border: "1px solid var(--line)",
                      borderRadius: 12
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="followers"
                    stroke="var(--accent-dark)"
                    strokeWidth={2}
                    dot={false}
                    name="Followers"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}

        <div className="panel span-12">
          <h3>Engagement rate over time</h3>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={lineData}>
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: "var(--muted)", fontSize: 11 }} />
                <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{
                    background: "var(--panel)",
                    border: "1px solid var(--line)",
                    borderRadius: 12
                  }}
                  formatter={(value: number) => [`${value.toFixed(1)}%`, "Engagement"]}
                />
                <Line
                  type="monotone"
                  dataKey="engagementPct"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={false}
                  name="Engagement %"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel span-6">
          <h3>Posts by hour</h3>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={hourly}>
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
                <XAxis dataKey="hour" tick={{ fill: "var(--muted)", fontSize: 10 }} />
                <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--panel)",
                    border: "1px solid var(--line)",
                    borderRadius: 12
                  }}
                />
                <Bar dataKey="postCount" fill="var(--accent)" radius={[6, 6, 0, 0]} name="Posts" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel span-6">
          <h3>Media type breakdown</h3>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={mediaTypes} layout="vertical">
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fill: "var(--muted)", fontSize: 10 }} />
                <YAxis type="category" dataKey="mediaType" width={72} tick={{ fill: "var(--muted)", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--panel)",
                    border: "1px solid var(--line)",
                    borderRadius: 12
                  }}
                />
                <Bar dataKey="postCount" fill="var(--accent-dark)" radius={[0, 6, 6, 0]} name="Posts" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel span-12">
          <h3>Top posts</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left" style={{ padding: "8px 0", color: "var(--muted)" }}>
                    Preview
                  </th>
                  <th align="left" style={{ padding: "8px 0", color: "var(--muted)" }}>
                    Caption
                  </th>
                  <th align="left" style={{ padding: "8px 0", color: "var(--muted)" }}>
                    ER
                  </th>
                  <th align="left" style={{ padding: "8px 0", color: "var(--muted)" }}>
                    Reach
                  </th>
                </tr>
              </thead>
              <tbody>
                {topPosts.map((row) => (
                  <tr key={row.id}>
                    <td style={{ padding: "10px 8px 10px 0", verticalAlign: "top", width: 88 }}>
                      {row.mediaUrl ? (
                        <img
                          src={row.mediaUrl}
                          alt=""
                          width={72}
                          height={72}
                          style={{ borderRadius: 12, objectFit: "cover", border: "1px solid var(--line)" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 72,
                            height: 72,
                            borderRadius: 12,
                            background: "var(--panel-strong)",
                            border: "1px solid var(--line)"
                          }}
                        />
                      )}
                    </td>
                    <td style={{ padding: "10px 8px", maxWidth: 420 }}>{row.captionPreview || "—"}</td>
                    <td style={{ padding: "10px 8px" }}>{formatEr(row.engagementRate)}</td>
                    <td style={{ padding: "10px 8px" }}>{Math.round(row.reach)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
