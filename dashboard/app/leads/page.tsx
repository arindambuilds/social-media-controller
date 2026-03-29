"use client";

import { Copy, Mail, MessageCircle, Sparkles, SquareArrowOutUpRight } from "lucide-react";
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

function statusBadgeClass(status: LeadStatus): string {
  const map: Record<LeadStatus, string> = {
    NEW: "border-accent-purple/45 bg-accent-purple/15 text-accent-purple",
    CONTACTED: "border-warning/45 bg-warning/15 text-warning",
    CONVERTED: "border-accent-teal/45 bg-accent-teal/15 text-accent-teal",
    LOST: "border-subtle bg-surface text-muted"
  };
  return map[status];
}

function isInstagramSource(source: string): boolean {
  const s = source.toLowerCase();
  return s.includes("instagram") || s.includes("ig") || s.includes("comment") || s.includes("dm");
}

function SourceCell({ source }: { source: string }) {
  const ig = isInstagramSource(source);
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-subtle ${
          ig ? "bg-gradient-to-br from-accent-purple/25 to-accent-teal/20 text-accent-teal" : "bg-surface text-muted"
        }`}
      >
        {ig ? <MessageCircle size={18} strokeWidth={2} aria-hidden /> : <Sparkles size={18} strokeWidth={2} aria-hidden />}
      </span>
      <span className="text-ink font-medium">{source}</span>
    </span>
  );
}

function LeadsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <div
        className="mb-6 flex h-28 w-28 items-center justify-center rounded-full border border-subtle shadow-glow"
        style={{
          background:
            "linear-gradient(145deg, rgba(108,99,255,0.2), rgba(0,212,170,0.12))"
        }}
        aria-hidden
      >
        <MessageCircle className="text-accent-teal" size={48} strokeWidth={1.5} />
      </div>
      <h3 className="text-ink font-display text-lg font-bold">No leads yet</h3>
      <p className="text-muted mt-2 max-w-md text-sm leading-relaxed">
        When comments or DMs look like bookings or product interest, they will show up here so you can follow up fast.
      </p>
    </div>
  );
}

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [copyFlash, setCopyFlash] = useState<string | null>(null);

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

  async function copyId(leadId: string) {
    try {
      await navigator.clipboard.writeText(leadId);
      setCopyFlash(leadId);
      setTimeout(() => setCopyFlash(null), 1600);
    } catch {
      /* ignore */
    }
  }

  if (loading) {
    return (
      <div className="page-shell">
        <div className="gradient-border flex items-center gap-3 p-6">
          <div className="spinner" aria-label="Loading leads" />
          <span className="text-muted text-sm">Loading leads…</span>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-24 w-full rounded-[14px]" />
          ))}
        </div>
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

      {error ? <p className="text-error mt-4">{error}</p> : null}

      <section className="gradient-border mt-6 p-4 md:p-6">
        {leads.length === 0 && !error ? (
          <LeadsEmptyState />
        ) : leads.length > 0 ? (
          <div className="flex flex-col gap-3">
            <div
              className={`text-muted hidden gap-4 border-b border-subtle pb-3 text-xs font-semibold uppercase tracking-wide md:grid md:items-center ${
                role === "CLIENT_USER"
                  ? "md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,0.85fr)_minmax(0,1fr)_auto]"
                  : "md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto]"
              }`}
            >
              <span>Name</span>
              {role !== "CLIENT_USER" ? <span>Business / IG</span> : null}
              <span>Source</span>
              <span>Status</span>
              <span>Created</span>
              <span className="text-right">Actions</span>
            </div>

            {leads.map((lead) => {
              const ig = lead.client?.socialAccounts?.[0];
              const handle = ig?.platformUsername ? `@${ig.platformUsername}` : "—";
              const sync = ig?.lastSyncedAt ? "Connected" : "Pending";
              const mailHref = `mailto:?subject=${encodeURIComponent(`Lead: ${lead.contactName || lead.sourceId}`)}&body=${encodeURIComponent(`Lead ID: ${lead.id}\nSource: ${lead.source}\n`)}`;

              const rowGrid =
                role === "CLIENT_USER"
                  ? "md:grid md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,0.85fr)_minmax(0,1fr)_auto] md:items-center md:gap-4"
                  : "md:grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto] md:items-center md:gap-4";

              return (
                <div key={lead.id} className={`lead-row-card flex flex-col gap-4 px-4 py-4 ${rowGrid}`}>
                  <div className="min-w-0">
                    <span className="text-muted text-[0.65rem] font-bold uppercase tracking-wide md:hidden">Name</span>
                    <div className="text-ink font-semibold">{lead.contactName || lead.sourceId}</div>
                  </div>

                  {role !== "CLIENT_USER" ? (
                    <div className="min-w-0">
                      <span className="text-muted text-[0.65rem] font-bold uppercase tracking-wide md:hidden">
                        Business / IG
                      </span>
                      <div className="text-ink">{lead.client?.name ?? "—"}</div>
                      <div className="text-muted mt-0.5 text-xs">
                        {handle} · {sync}
                      </div>
                    </div>
                  ) : null}

                  <div className="min-w-0">
                    <span className="text-muted text-[0.65rem] font-bold uppercase tracking-wide md:hidden">Source</span>
                    <SourceCell source={lead.source} />
                  </div>

                  <div className="min-w-0">
                    <span className="text-muted text-[0.65rem] font-bold uppercase tracking-wide md:hidden">Status</span>
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(lead.status)}`}
                    >
                      {lead.status}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <span className="text-muted text-[0.65rem] font-bold uppercase tracking-wide md:hidden">Created</span>
                    <div className="text-muted text-sm tabular-nums">{new Date(lead.createdAt).toLocaleString()}</div>
                  </div>

                  <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
                    <button
                      type="button"
                      className={`lead-action-btn ${copyFlash === lead.id ? "!border-accent-teal !text-accent-teal" : ""}`}
                      onClick={() => copyId(lead.id)}
                      aria-label="Copy lead ID"
                    >
                      <Copy size={18} strokeWidth={2} aria-hidden />
                      <span className="lead-action-label">{copyFlash === lead.id ? "Copied" : "Copy ID"}</span>
                    </button>
                    <a className="lead-action-btn" href={mailHref} aria-label="Draft email about this lead">
                      <Mail size={18} strokeWidth={2} aria-hidden />
                      <span className="lead-action-label">Email</span>
                    </a>
                    <Link className="lead-action-btn" href="/analytics" aria-label="Open analytics">
                      <SquareArrowOutUpRight size={18} strokeWidth={2} aria-hidden />
                      <span className="lead-action-label">Analytics</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}
