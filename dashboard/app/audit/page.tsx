"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetchResponse, fetchMe, parseApiErrorMessage } from "../../lib/api";
import { CLIENT_ID_KEY, getStoredClientId, getStoredToken } from "../../lib/auth-storage";
import { ListPageSkeleton } from "../../components/page-skeleton";
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
  const [role, setRole] = useState<string | null>(null);
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
    const res = await apiFetchResponse(`/audit-logs?${q.toString()}`);
    const text = await res.text();
    let body: unknown = {};
    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = { _raw: text };
      }
    }
    if (res.status === 403) throw new Error("Agency admin only.");
    if (!res.ok) throw new Error(parseApiErrorMessage(body) || text.slice(0, 200) || `HTTP ${res.status}`);
    const data = body as { logs: AuditRow[]; pagination: { total: number } };
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
        const me = await fetchMe();
        setRole(me.user.role);
        if (me.user.role !== "AGENCY_ADMIN") {
          setLoading(false);
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
    if (!clientId || role !== "AGENCY_ADMIN") return;
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
  }, [clientId, page, actionFilter, load, role]);

  if (loading) {
    return <ListPageSkeleton label="Loading audit log…" />;
  }

  if (role === "CLIENT_USER") {
    return (
      <div className="page-shell">
        <PageHeader
          eyebrow="Security"
          title="Audit log"
          description="This feature is available for agency accounts."
        />
        <section className="panel span-12" style={{ marginTop: 20, padding: "28px 24px" }}>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: "var(--text-secondary)" }}>
            This feature is available for agency accounts. Your login does not include access to audit history — contact
            your agency if you need activity visibility.
          </p>
          <Link href="/dashboard" className="button" style={{ marginTop: 20, display: "inline-block" }}>
            Back to dashboard
          </Link>
        </section>
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
        <span className="muted">{total} total</span>
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
        <button type="button" className="button secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Previous
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={page * perPage >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
