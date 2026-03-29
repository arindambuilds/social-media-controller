"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, fetchMe } from "../../lib/api";
import { CLIENT_ID_KEY, getStoredClientId, getStoredToken } from "../../lib/auth-storage";
import { PageHeader } from "../../components/ui/page-header";

type LeadStatus = "NEW" | "CONTACTED" | "CONVERTED" | "LOST";

type Lead = {
  id: string;
  sourceId: string;
  contactName: string;
  source: string;
  status: LeadStatus;
  createdAt: string;
  client?: {
    id: string;
    name: string;
    socialAccounts: Array<{
      platformUsername: string | null;
      lastSyncedAt: string | null;
      followerCount: number | null;
    }>;
  };
};

const statusColors: Record<LeadStatus, string> = {
  NEW: "var(--accent)",
  CONTACTED: "var(--warning)",
  CONVERTED: "var(--success)",
  LOST: "var(--muted)"
};

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (clientId: string) => {
    const path = `/leads?clientId=${encodeURIComponent(clientId)}&page=1&limit=50`;
    const data = await apiFetch<{ success: boolean; leads: Lead[] }>(path);
    setLeads(data.leads ?? []);
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
        let cid: string | null = getStoredClientId() ?? me.user.clientId;
        if (!cid && me.user.role === "AGENCY_ADMIN") {
          cid = "demo-client";
        }
        if (cid) localStorage.setItem(CLIENT_ID_KEY, cid);

        if (me.user.role === "CLIENT_USER") {
          if (!cid) {
            setError("No client ID — log in with an account linked to a business.");
            setLoading(false);
            return;
          }
          await load(cid);
        } else if (cid) {
          await load(cid);
        } else {
          setError("No client context — assign a client to your agency user or use the demo operator login.");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load leads");
      } finally {
        setLoading(false);
      }
    })();
  }, [router, load]);

  if (loading) {
    return (
      <div className="page-shell">
        <div className="panel" style={{ display: "flex", alignItems: "center", gap: 12, padding: 32 }}>
          <div className="spinner" aria-label="Loading leads" />
          <span className="muted">Loading leads…</span>
        </div>
        <div className="skeleton" style={{ height: 120, marginTop: 16 }} />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Pipeline"
        title="Leads from Instagram"
        description="Comments and DMs flagged as interest — follow up before they go cold."
        actions={
          <Link href="/dashboard" className="button secondary">
            Back to dashboard
          </Link>
        }
      />

      {error ? <p className="text-error">{error}</p> : null}

      <section className="panel span-12">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th align="left" style={{ padding: "10px 8px", color: "var(--muted)", fontSize: "0.8125rem" }}>
                  Name
                </th>
                {role !== "CLIENT_USER" ? (
                  <th align="left" style={{ padding: "10px 8px", color: "var(--muted)", fontSize: "0.8125rem" }}>
                    Business / IG
                  </th>
                ) : null}
                <th align="left" style={{ padding: "10px 8px", color: "var(--muted)", fontSize: "0.8125rem" }}>
                  Source
                </th>
                <th align="left" style={{ padding: "10px 8px", color: "var(--muted)", fontSize: "0.8125rem" }}>
                  Status
                </th>
                <th align="left" style={{ padding: "10px 8px", color: "var(--muted)", fontSize: "0.8125rem" }}>
                  Created
                </th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td
                    colSpan={role === "CLIENT_USER" ? 4 : 5}
                    className="muted"
                    style={{ padding: 24 }}
                  >
                    No leads yet. When comments or DMs look like bookings, they will show here.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => {
                  const ig = lead.client?.socialAccounts?.[0];
                  const handle = ig?.platformUsername ? `@${ig.platformUsername}` : "—";
                  const sync = ig?.lastSyncedAt ? "Connected" : "Pending";
                  return (
                    <tr key={lead.id}>
                      <td style={{ padding: "12px 8px" }}>{lead.contactName || lead.sourceId}</td>
                      {role !== "CLIENT_USER" ? (
                        <td style={{ padding: "12px 8px" }}>
                          <div>{lead.client?.name ?? "—"}</div>
                          <div className="muted" style={{ fontSize: "0.8125rem" }}>
                            {handle} · {sync}
                          </div>
                        </td>
                      ) : null}
                      <td style={{ padding: "12px 8px" }}>{lead.source}</td>
                      <td style={{ padding: "12px 8px" }}>
                        <span style={{ color: statusColors[lead.status], fontWeight: 700 }}>{lead.status}</span>
                      </td>
                      <td style={{ padding: "12px 8px" }}>{new Date(lead.createdAt).toLocaleString()}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
