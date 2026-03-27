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
import { apiFetch } from "../../lib/api";
import { CLIENT_ID_KEY, getStoredClientId, getStoredToken } from "../../lib/auth-storage";

type Overview = {
  success: boolean;
  totalPosts: number;
  avgEngagementRate: number;
  totalReach: number;
  bestHour: number | null;
  timeSeries: { points: Array<{ date: string; engagementRate: number }> };
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

export default function AnalyticsPage() {
  const router = useRouter();
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [hourly, setHourly] = useState<HourlyRow[]>([]);
  const [mediaTypes, setMediaTypes] = useState<MediaRow[]>([]);
  const [topPosts, setTopPosts] = useState<PostRow[]>([]);

  const load = useCallback(async (cid: string) => {
    setError("");
    const [oRes, hRes, mRes, pRes] = await Promise.all([
      apiFetch(`/analytics/${encodeURIComponent(cid)}/overview?days=30`),
      apiFetch(`/analytics/${encodeURIComponent(cid)}/insights/hourly`),
      apiFetch(`/analytics/${encodeURIComponent(cid)}/insights/media-type`),
      apiFetch(`/analytics/${encodeURIComponent(cid)}/posts?limit=5&sort=engagement`)
    ]);
    if (!oRes.ok) throw new Error(await oRes.text());
    if (!hRes.ok) throw new Error(await hRes.text());
    if (!mRes.ok) throw new Error(await mRes.text());
    if (!pRes.ok) throw new Error(await pRes.text());
    const o = (await oRes.json()) as Overview;
    const h = (await hRes.json()) as { hours: HourlyRow[] };
    const m = (await mRes.json()) as { types: MediaRow[] };
    const p = (await pRes.json()) as { posts: PostRow[] };
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
        if (!cid) {
          const { fetchMe } = await import("../../lib/api");
          const me = await fetchMe(token);
          cid = me.user.clientId;
          if (cid) localStorage.setItem(CLIENT_ID_KEY, cid);
        }
        if (!cid) {
          setError("No client ID for this account. Log in with a user that has a client assigned.");
          setLoading(false);
          return;
        }
        setClientId(cid);
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
      <div className="page-shell">
        <section className="panel span-12">
          <h2>Analytics</h2>
          <div className="stats-grid">
            {[1, 2, 3, 4].map((k) => (
              <div key={k} className="stat-card">
                <div className="skeleton" style={{ height: 14, marginBottom: 12 }} />
                <div className="skeleton" style={{ height: 36, width: "60%" }} />
              </div>
            ))}
          </div>
          <div className="skeleton span-12" style={{ height: 280, marginTop: 24, gridColumn: "span 12" }} />
        </section>
      </div>
    );
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

  const empty = overview && overview.totalPosts === 0;

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

  return (
    <div className="page-shell">
      <section className="panel span-12">
        <h2>Analytics</h2>
        {clientId ? <p className="muted">Client {clientId}</p> : null}
      </section>

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
