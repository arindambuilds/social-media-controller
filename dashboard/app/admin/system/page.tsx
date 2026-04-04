"use client";

/** page-enter: `usePageEnter` + `key={pathname}` on the root wrapper. */

import { Activity, AlertTriangle, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { API_ORIGIN, apiFetch, fetchMe } from "../../../lib/api";
import { getAccessToken } from "../../../lib/auth-storage";
import { ListPageSkeleton } from "../../../components/page-skeleton";
import { usePageEnter } from "@/hooks/usePageEnter";

type HealthComponent = { status: "ok" | "error" | "skipped"; detail?: string };

type LiveHealthPayload = {
  status: string;
  timestamp: string;
  components?: Record<string, HealthComponent>;
};

const COMPONENT_LABELS: Record<string, string> = {
  database: "Database",
  redis: "Redis / job queue cache",
  instagram_api: "Instagram Graph API",
  claude_api: "Claude API",
  bullmq: "Background jobs (BullMQ)",
  last_briefing: "Last briefing sent"
};

function labelForComponent(key: string): string {
  return COMPONENT_LABELS[key] ?? key.replace(/_/g, " ");
}

type SystemPayload = {
  success: boolean;
  clients: Array<{
    id: string;
    name: string;
    ownerEmail: string;
    whatsappNumber: string | null;
    briefingEnabled: boolean;
    briefingHourIst: number;
    ingestionPausedUntil: string | null;
    lastBriefingAt: string | null;
    lastWhatsappDelivered: boolean | null;
    lastEmailDelivered: boolean | null;
  }>;
  failures24h: Array<{ id: string; category: string; message: string; at: string }>;
  health: {
    status: string;
    timestamp: string;
    components: Record<string, HealthComponent>;
  };
};

function StatusDot({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 className="text-accent-teal inline-block" size={18} aria-label="OK" />
  ) : (
    <XCircle className="text-danger inline-block" size={18} aria-label="Issue" />
  );
}

function HealthStatusCard({ name, comp }: { name: string; comp: HealthComponent }) {
  const operational = comp.status === "ok";
  const notInUse = comp.status === "skipped";
  const failed = comp.status === "error";
  const borderClass = failed
    ? "border-danger/40 bg-danger/5"
    : notInUse
      ? "border-subtle bg-surface/40"
      : operational
        ? "border-accent-teal/35 bg-accent-teal/5"
        : "border-warning/40 bg-warning/5";
  const pillClass = failed
    ? "bg-danger/20 text-danger"
    : notInUse
      ? "bg-surface text-muted"
      : operational
        ? "bg-accent-teal/20 text-accent-teal"
        : "bg-warning/20 text-warning";

  const pillText = failed ? "Down" : notInUse ? "Not configured" : operational ? "Operational" : "Unknown";

  return (
    <div
      className={`rounded-2xl border px-4 py-3 shadow-sm backdrop-blur-sm ${borderClass}`}
      role="status"
      aria-label={`${name}: ${pillText}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-ink font-display text-sm font-semibold tracking-tight">{name}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide ${pillClass}`}>
          {pillText}
        </span>
      </div>
      {comp.detail ? (
        <p className="text-muted mt-2 font-mono text-[0.7rem] leading-relaxed break-words">{comp.detail}</p>
      ) : (
        <p className="text-muted mt-2 text-xs">{notInUse ? "Optional dependency not in use." : "No extra detail."}</p>
      )}
    </div>
  );
}

export default function AdminSystemPage() {
  const pathname = usePathname();
  const pageClassName = usePageEnter();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [data, setData] = useState<SystemPayload | null>(null);
  const [error, setError] = useState("");
  const [liveHealth, setLiveHealth] = useState<LiveHealthPayload | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState("");

  const fetchLiveHealth = useCallback(async () => {
    setLiveLoading(true);
    setLiveError("");
    try {
      const res = await fetch(`${API_ORIGIN}/api/health?deps=1`, { cache: "no-store" });
      const json = (await res.json()) as LiveHealthPayload;
      if (!res.ok) {
        setLiveError("Could not load live dependency checks.");
        setLiveHealth(null);
        return;
      }
      setLiveHealth(json);
    } catch {
      setLiveError("Network error while checking system health.");
      setLiveHealth(null);
    } finally {
      setLiveLoading(false);
    }
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
        if (me.user.role !== "AGENCY_ADMIN") {
          setForbidden(true);
          setLoading(false);
          return;
        }
        const json = await apiFetch<SystemPayload>("/admin/system");
        setData(json);
        void fetchLiveHealth();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [router, fetchLiveHealth]);

  useEffect(() => {
    if (forbidden || loading) return;
    const t = setInterval(() => void fetchLiveHealth(), 60_000);
    return () => clearInterval(t);
  }, [forbidden, loading, fetchLiveHealth]);

  if (loading) {
    return (
      <div key={pathname} className={pageClassName}>
        <ListPageSkeleton label="Loading system overview…" />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div key={pathname} className={`page-shell ${pageClassName}`}>
        <section className="panel span-12">
          <h1 className="text-ink font-display text-xl font-bold">System</h1>
          <p className="text-muted mt-3 text-sm">This page is only for agency admins.</p>
          <Link className="button mt-4 inline-block" href="/dashboard">
            Back to dashboard
          </Link>
        </section>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div key={pathname} className={`page-shell ${pageClassName}`}>
        <section className="panel span-12">
          <h1 className="text-ink font-display text-xl font-bold">System</h1>
          <p className="text-error mt-3">{error || "No data"}</p>
        </section>
      </div>
    );
  }

  const snapshotEntries = Object.entries(data.health.components ?? {});

  const liveComponents = liveHealth?.components ?? null;
  const liveOverall = liveHealth?.status ?? "unknown";
  const liveCheckedAt = liveHealth?.timestamp
    ? new Date(liveHealth.timestamp).toLocaleString()
    : null;

  return (
    <div key={pathname} className={`page-shell ${pageClassName}`}>
      <section className="panel span-12 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Activity className="text-[#C8A951]" size={28} aria-hidden />
            <div>
              <h1 className="text-ink font-display m-0 text-2xl font-bold tracking-tight">Ops center</h1>
              <p className="text-muted m-0 mt-1 text-sm">Live service status, clients, and recent failures.</p>
            </div>
          </div>
          <button
            type="button"
            className="button secondary inline-flex items-center gap-2 text-sm"
            onClick={() => void fetchLiveHealth()}
            disabled={liveLoading}
          >
            <RefreshCw size={16} className={liveLoading ? "animate-spin" : ""} aria-hidden />
            Refresh status
          </button>
        </div>
      </section>

      <section className="panel span-12 mb-6 border border-ink/10 bg-ink/[0.04] backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-ink font-display m-0 text-lg font-bold">Live dependency status</h2>
          {liveCheckedAt ? (
            <span className="text-muted font-mono text-xs">Last check: {liveCheckedAt}</span>
          ) : null}
        </div>
        <p className="text-muted mt-1 text-sm">
          Pulled from <code className="text-ink/80">/api/health?deps=1</code> — refreshes every 60 seconds. Same signals
          you would show on a public status page (no secrets).
        </p>

        {liveError ? (
          <div className="border-danger/30 bg-danger/10 mt-4 rounded-xl border px-4 py-3 text-sm text-danger">
            {liveError}
            <button type="button" className="button secondary ml-3 px-3 py-1 text-xs" onClick={() => void fetchLiveHealth()}>
              Retry
            </button>
          </div>
        ) : null}

        {liveComponents && !liveError ? (
          <>
            <div
              className={`mt-4 flex flex-wrap items-center gap-2 rounded-xl border px-4 py-3 ${
                liveOverall === "ok"
                  ? "border-accent-teal/30 bg-accent-teal/10"
                  : "border-warning/35 bg-warning/10"
              }`}
            >
              <span className="text-ink font-display text-sm font-bold">Overall</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${
                  liveOverall === "ok" ? "bg-accent-teal/25 text-accent-teal" : "bg-warning/25 text-warning"
                }`}
              >
                {liveOverall === "ok" ? "All critical paths OK" : "Degraded — review components"}
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(liveComponents).map(([key, comp]) => (
                <HealthStatusCard key={key} name={labelForComponent(key)} comp={comp} />
              ))}
            </div>
          </>
        ) : null}

        {!liveComponents && !liveError && liveLoading ? (
          <p className="text-muted mt-4 text-sm">Checking dependencies…</p>
        ) : null}
      </section>

      <section className="panel span-12 mb-6">
        <h2 className="text-ink font-display text-lg font-bold">Snapshot (from last admin load)</h2>
        <p className="text-muted text-xs">Embedded in admin API — use live section above for current probes.</p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {snapshotEntries.map(([key, c]) => (
            <li
              key={key}
              className="flex items-start justify-between gap-2 rounded-xl border border-subtle bg-surface/60 px-3 py-2 text-sm"
            >
              <span className="text-muted text-xs">{labelForComponent(key)}</span>
              <span className="text-ink text-right text-xs">
                <StatusDot ok={c.status !== "error"} /> {c.status}
                {c.detail ? <span className="text-muted block">{c.detail}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel span-12 mb-6">
        <h2 className="text-ink font-display text-lg font-bold">Clients</h2>
        <div className="table-wrap mt-4">
          <table className="data-table text-sm">
            <thead>
              <tr>
                <th>Name</th>
                <th>Owner email</th>
                <th>Briefing</th>
                <th>Last sent</th>
                <th>WA / Email</th>
              </tr>
            </thead>
            <tbody>
              {data.clients.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td className="max-w-[140px] truncate">{c.ownerEmail}</td>
                  <td>
                    {c.briefingEnabled ? `On @ ${c.briefingHourIst}:00 IST` : "Off"}
                    {c.ingestionPausedUntil ? (
                      <span className="text-warning block text-xs">Ingestion paused</span>
                    ) : null}
                  </td>
                  <td>{c.lastBriefingAt ? new Date(c.lastBriefingAt).toLocaleString() : "—"}</td>
                  <td>
                    {c.lastWhatsappDelivered === true ? "WA ✓" : c.lastWhatsappDelivered === false ? "WA ✗" : "WA —"} /{" "}
                    {c.lastEmailDelivered === true ? "Email ✓" : c.lastEmailDelivered === false ? "Email ✗" : "Email —"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel span-12">
        <h2 className="text-ink font-display flex items-center gap-2 text-lg font-bold">
          <AlertTriangle className="text-warning" size={20} aria-hidden />
          Failed jobs / errors (24h)
        </h2>
        {data.failures24h.length === 0 ? (
          <p className="text-muted mt-3 text-sm">No errors logged in the last 24 hours.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {data.failures24h.map((f) => (
              <li key={f.id} className="rounded-xl border border-subtle bg-surface/60 px-3 py-2 text-sm">
                <span className="text-muted text-xs">{new Date(f.at).toLocaleString()}</span>
                <span className="text-muted ml-2 text-xs">[{f.category}]</span>
                <p className="text-ink m-0 mt-1">{f.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
