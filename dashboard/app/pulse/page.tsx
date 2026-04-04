"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/auth-context";
import { apiFetch } from "../../lib/api";
import { usePageEnter } from "../../hooks/usePageEnter";

type PulseSummary = {
  clientId: string;
  pulseTier: string;
  businessType: string | null;
  metricsTracked: string[];
  onboardingCompletedAt: string | null;
  streak: { current: number; best: number };
  lastBriefing: {
    sentAt: string;
    whatsappDelivered: boolean | null;
    emailDelivered: boolean | null;
    pulseTierSnapshot: string | null;
  } | null;
  upgradeHint: string | null;
};

type BriefingRow = {
  id: string;
  sentAt: string;
  whatsappDelivered: boolean | null;
  emailDelivered: boolean | null;
  pulseTierSnapshot: string | null;
  tipPreview: string | null;
};

const BUSINESS_TYPES = [
  { value: "coaching", label: "Coaching / training" },
  { value: "real_estate", label: "Real estate" },
  { value: "agency", label: "Digital agency" },
  { value: "retail", label: "Retail / local business" },
  { value: "other", label: "Other" }
] as const;

const METRIC_OPTS = [
  { id: "leads", label: "Leads / inquiries" },
  { id: "followers", label: "Followers" },
  { id: "sales", label: "Sales / bookings" },
  { id: "reach", label: "Reach / engagement" }
] as const;

function formatSentAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function deliveryLabel(wa: boolean | null, em: boolean | null): string {
  if (wa === true) return "WhatsApp sent";
  if (wa === false) return "WhatsApp failed";
  if (wa == null && em === true) return "Email sent";
  if (em === false) return "Email failed";
  return "Queued / pending";
}

export default function PulseBriefingsPage() {
  const pathname = usePathname();
  const pageClassName = usePageEnter();
  const { token, isReady, user } = useAuth();
  const searchParams = useSearchParams();
  const clientIdParam = searchParams?.get("clientId") ?? null;
  const clientQuery = clientIdParam?.trim() || user?.clientId?.trim() || "";

  const [summary, setSummary] = useState<PulseSummary | null>(null);
  const [briefings, setBriefings] = useState<BriefingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingOnboarding, setSavingOnboarding] = useState(false);
  const [bizType, setBizType] = useState<string>("");
  const [metrics, setMetrics] = useState<Set<string>>(new Set());

  const summaryUrl = useMemo(
    () =>
      clientQuery
        ? `/pulse/client/summary?clientId=${encodeURIComponent(clientQuery)}`
        : "/pulse/client/summary",
    [clientQuery]
  );
  const briefingsUrl = useMemo(
    () =>
      clientQuery
        ? `/pulse/client/briefings?limit=7&clientId=${encodeURIComponent(clientQuery)}`
        : "/pulse/client/briefings?limit=7",
    [clientQuery]
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [s, b] = await Promise.all([
        apiFetch<PulseSummary>(summaryUrl),
        apiFetch<{ briefings: BriefingRow[] }>(briefingsUrl)
      ]);
      setSummary(s);
      setBriefings(b.briefings ?? []);
      if (s.businessType) setBizType(s.businessType);
      setMetrics(new Set(s.metricsTracked ?? []));
      void apiFetch("/pulse/client/engagement/briefing-opened", {
        method: "POST",
        body: JSON.stringify(clientQuery ? { clientId: clientQuery } : {})
      }).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load Pulse data.");
      setSummary(null);
      setBriefings([]);
    } finally {
      setLoading(false);
    }
  }, [token, summaryUrl, briefingsUrl, clientQuery]);

  useEffect(() => {
    if (!isReady || !token) return;
    void load();
  }, [isReady, token, load]);

  async function saveOnboarding(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSavingOnboarding(true);
    setError(null);
    try {
      await apiFetch("/pulse/client/onboarding", {
        method: "PATCH",
        body: JSON.stringify({
          ...(clientQuery ? { clientId: clientQuery } : {}),
          businessType: bizType || undefined,
          metricsTracked: Array.from(metrics)
        })
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSavingOnboarding(false);
    }
  }

  function toggleMetric(id: string) {
    setMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!isReady) {
    return (
      <div key={pathname} className={`flex min-h-[40vh] items-center justify-center p-6 text-sm text-white/40 ${pageClassName}`}>
        Checking session…
      </div>
    );
  }

  if (!token) {
    return (
      <div key={pathname} className={`max-w-lg space-y-4 p-6 md:p-8 ${pageClassName}`}>
        <h1 className="font-display text-2xl font-bold text-white">Daily briefing</h1>
        <p className="text-sm text-white/50">Sign in to see your last briefings and delivery status.</p>
        <Link href="/login" className="inline-block rounded-xl bg-white/10 px-4 py-2 text-sm text-white">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div key={pathname} className={`max-w-2xl space-y-8 p-6 md:p-8 ${pageClassName}`}>
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Daily briefing</h1>
        <p className="mt-1 text-sm text-white/45">
          WhatsApp stays primary — this page is a light backup for history and delivery status.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
          <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
        </div>
      ) : summary ? (
        <>
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-white/35">Plan tier</p>
                <p className="mt-1 text-lg font-semibold capitalize text-white">{summary.pulseTier}</p>
                <p className="mt-2 text-sm text-white/45">
                  Streak: <span className="text-white/80">{summary.streak.current}</span> days (best{" "}
                  {summary.streak.best})
                </p>
              </div>
              <Link
                href="/billing"
                className="shrink-0 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-sm font-medium text-emerald-200"
              >
                Upgrade
              </Link>
            </div>
            {summary.upgradeHint ? (
              <p className="mt-4 border-t border-white/10 pt-4 text-sm text-amber-100/90">{summary.upgradeHint}</p>
            ) : null}
            {summary.lastBriefing ? (
              <p className="mt-3 text-xs text-white/35">
                Last run: {formatSentAt(summary.lastBriefing.sentAt)} ·{" "}
                {deliveryLabel(summary.lastBriefing.whatsappDelivered, summary.lastBriefing.emailDelivered)}
              </p>
            ) : (
              <p className="mt-3 text-xs text-white/35">No briefing logged yet — connect WhatsApp and enable morning send.</p>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/40">Last 7 briefings</h2>
            <ul className="mt-3 space-y-2">
              {briefings.length === 0 ? (
                <li className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-white/40">
                  No rows yet.
                </li>
              ) : (
                briefings.map((b) => (
                  <li
                    key={b.id}
                    className="flex flex-col gap-1 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{formatSentAt(b.sentAt)}</p>
                      <p className="text-xs text-white/40">
                        {deliveryLabel(b.whatsappDelivered, b.emailDelivered)}
                        {b.pulseTierSnapshot ? ` · tier ${b.pulseTierSnapshot}` : ""}
                      </p>
                    </div>
                    {b.tipPreview ? (
                      <p className="max-w-md text-xs text-white/50 sm:text-right">{b.tipPreview}</p>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-sm font-semibold text-white">Onboarding</h2>
            <p className="mt-1 text-xs text-white/40">
              Helps us tune your first briefings (business type + what you track). You can change anytime.
            </p>
            <form className="mt-4 space-y-4" onSubmit={saveOnboarding}>
              <label className="block text-xs font-medium text-white/50">
                Business type
                <select
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
                  value={bizType}
                  onChange={(e) => setBizType(e.target.value)}
                >
                  <option value="">Select…</option>
                  {BUSINESS_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <p className="text-xs font-medium text-white/50">Metrics you care about</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {METRIC_OPTS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMetric(m.id)}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        metrics.has(m.id)
                          ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-100"
                          : "border-white/15 text-white/50"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="submit"
                disabled={savingOnboarding}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {savingOnboarding ? "Saving…" : "Save preferences"}
              </button>
            </form>
          </section>
        </>
      ) : null}
    </div>
  );
}
