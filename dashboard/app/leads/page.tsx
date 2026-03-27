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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (token: string, clientId: string) => {
    const res = await apiFetch(`/leads?clientId=${encodeURIComponent(clientId)}`);
    if (!res.ok) {
      throw new Error(await res.text());
    }
    const data = (await res.json()) as { success: boolean; leads: Lead[] };
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
        let cid: string | null = getStoredClientId();
        if (!cid) {
          const me = await fetchMe(token);
          cid = me.user.clientId;
          if (cid) localStorage.setItem(CLIENT_ID_KEY, cid);
        }
        if (!cid) {
          setError("No client ID — log in with an account linked to a business.");
          setLoading(false);
          return;
        }
        await load(token, cid);
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
        <div className="skeleton" style={{ height: 120 }} />
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
          <Link href="/analytics" className="button secondary">
            Back to analytics
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
                  Contact
                </th>
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
                  <td colSpan={4} className="muted" style={{ padding: 24 }}>
                    No leads yet. When comments or DMs look like bookings, they will show here.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id}>
                    <td style={{ padding: "12px 8px" }}>{lead.contactName || lead.sourceId}</td>
                    <td style={{ padding: "12px 8px" }}>{lead.source}</td>
                    <td style={{ padding: "12px 8px" }}>
                      <span style={{ color: statusColors[lead.status], fontWeight: 700 }}>{lead.status}</span>
                    </td>
                    <td style={{ padding: "12px 8px" }}>{new Date(lead.createdAt).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
