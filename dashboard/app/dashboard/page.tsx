"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, fetchMe } from "../../lib/api";
import { useAuth } from "../../context/auth-context";
import { CLIENT_ID_KEY, getStoredClientId } from "../../lib/auth-storage";
import { PageHeader } from "../../components/ui/page-header";

export default function DashboardHomePage() {
  const router = useRouter();
  const { token, isReady, clearSession } = useAuth();
  const [name, setName] = useState<string | null>(null);
  const [clientLabel, setClientLabel] = useState<string | null>(null);
  const [igConnected, setIgConnected] = useState<boolean | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  const [avgEngagementRate, setAvgEngagementRate] = useState<number | null>(null);

  useEffect(() => {
    if (!isReady) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    (async () => {
      try {
        const me = await fetchMe(token);
        setName(me.user.name ?? me.user.email);
        if (me.user.clientId) {
          localStorage.setItem(CLIENT_ID_KEY, me.user.clientId);
          setClientLabel(me.user.clientId);
          setStatsLoading(true);
          try {
            const o = await apiFetch<{
              followerCount?: number | null;
              avgEngagementRate?: number;
            }>(`/analytics/${encodeURIComponent(me.user.clientId)}/overview?days=30`);
            setFollowerCount(o.followerCount ?? null);
            setAvgEngagementRate(
              typeof o.avgEngagementRate === "number" ? o.avgEngagementRate : null
            );
          } finally {
            setStatsLoading(false);
          }
        } else {
          setClientLabel(null);
          setFollowerCount(null);
          setAvgEngagementRate(null);
        }
        setIgConnected(me.instagramConnected);
      } catch {
        clearSession();
        router.replace("/login");
      }
    })();
  }, [isReady, token, router, clearSession]);

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

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Dashboard"
        title={name ? `Hi, ${name}` : "Welcome"}
        description={
          clientLabel
            ? `Client context: ${clientLabel}. Instagram: ${igConnected ? "connected" : "not connected yet"}.`
            : "Agency view — pick a client from Analytics or assign a client to your user."
        }
      />

      {clientLabel ? (
        <section className="panel" style={{ marginTop: 20 }}>
          <div className="eyebrow">Last 30 days</div>
          {statsLoading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
              <div className="spinner" aria-label="Loading stats" />
              <span className="muted">Loading analytics…</span>
            </div>
          ) : (
            <div className="stats-grid" style={{ marginTop: 12 }}>
              <div className="stat-card">
                <div className="muted" style={{ fontSize: 13 }}>
                  Followers
                </div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>
                  {followerCount != null ? followerCount.toLocaleString() : "—"}
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
            </div>
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

      <p className="muted" style={{ marginTop: 24 }}>
        Active client ID in storage: <code>{getStoredClientId() ?? "—"}</code>
      </p>
    </div>
  );
}
