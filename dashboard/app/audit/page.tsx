"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, fetchMe } from "../../lib/api";
import { CLIENT_ID_KEY, getStoredClientId, getStoredToken } from "../../lib/auth-storage";
import { PageHeader } from "../../components/ui/page-header";

type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  ipAddress: string | null;
  createdAt: string;
};

export default function AuditPage() {
  const router = useRouter();
  const [clientId, setClientId] = useState<string | null>(null);
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const perPage = 20;

  const load = useCallback(async (cid: string, p: number, act: string) => {
    const q = new URLSearchParams({
      clientId: cid,
      page: String(p),
      perPage: String(perPage)
    });
    if (act) q.set("action", act);
    const res = await apiFetch(`/audit-logs?${q.toString()}`);
    if (res.status === 403) throw new Error("Agency admin only.");
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as { logs: AuditRow[]; pagination: { total: number } };
    setLogs(data.logs ?? []);
    setTotal(data.pagination?.total ?? 0);
  }, []);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    (async () => {
      try {
        const me = await fetchMe(token);
        if (me.user.role !== "AGENCY_ADMIN") {
          setError("Audit log is available to agency admins only.");
          return;
        }
        const cid = getStoredClientId() ?? me.user.clientId ?? "demo-client";
        localStorage.setItem(CLIENT_ID_KEY, cid);
        setClientId(cid);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    (async () => {
      try {
        setError("");
        await load(clientId, page, actionFilter);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, page, actionFilter, load]);

  if (loading) {
    return (
      <div className="page-shell">
        <div className="panel" style={{ display: "flex", alignItems: "center", gap: 12, padding: 32 }}>
          <div className="spinner" aria-label="Loading audit log" />
          <span className="muted">Loading audit log…</span>
        </div>
        <div className="skeleton" style={{ height: 120, marginTop: 16 }} />
      </div>
    );
  }

  if (error && !logs.length && error.includes("Agency")) {
    return (
      <div className="page-shell">
        <PageHeader eyebrow="Security" title="Audit log" description="" />
        <p className="text-error">{error}</p>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Security"
        title="Audit log"
        description="Recent actions scoped to a client (agency view)."
      />
      {error ? <p className="text-error" style={{ marginBottom: 12 }}>{error}</p> : null}

      <div style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "center" }}>
        <label>
          Action contains{" "}
          <input
            className="input"
            style={{ maxWidth: 200 }}
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <span style={{ color: "var(--muted-foreground)" }}>
          {total} total
        </span>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Entity</th>
              <th>Entity ID</th>
              <th>Actor</th>
              <th>IP</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{l.action}</td>
                <td>{l.entityType}</td>
                <td style={{ fontFamily: "monospace", fontSize: 12 }}>{l.entityId}</td>
                <td style={{ fontFamily: "monospace", fontSize: 12 }}>{l.actorId ?? "—"}</td>
                <td>{l.ipAddress ?? "—"}</td>
                <td>{new Date(l.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
        <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Previous
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={page * perPage >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
