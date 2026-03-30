"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ListPageSkeleton } from "../../components/page-skeleton";
import { apiFetch, fetchMe } from "../../lib/api";
import { CLIENT_ID_KEY, getStoredClientId, getStoredToken } from "../../lib/auth-storage";
import { trackEvent } from "../../lib/trackEvent";

type OverviewResponse = {
  totalReach?: number | null;
};

type ClientProfile = {
  id: string;
  name: string;
  preferredInstagramHandle: string | null;
  whatsappNumber: string | null;
};

const BUSINESS_TYPES = [
  "Saree / Clothing",
  "Food & Restaurant",
  "Salon & Beauty",
  "Contractor / Services",
  "Retailer",
  "Other"
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState<(typeof BUSINESS_TYPES)[number] | null>(null);
  const [instagramHandle, setInstagramHandle] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showSnapshot, setShowSnapshot] = useState(false);
  const [avgDailyReach, setAvgDailyReach] = useState<number | null>(null);
  const [bestRecentReach, setBestRecentReach] = useState<number | null>(null);
  const [missedReach, setMissedReach] = useState<number | null>(null);
  const [missedRevenueLow, setMissedRevenueLow] = useState<number | null>(null);
  const [missedRevenueHigh, setMissedRevenueHigh] = useState<number | null>(null);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    (async () => {
      try {
        const me = await fetchMe();
        setBusinessName(me.user.name ?? me.user.email ?? "");
        let cid = getStoredClientId() ?? me.user.clientId ?? null;
        if (me.user.role === "AGENCY_ADMIN" && !cid) {
          cid = "demo-client";
        }
        if (!cid) {
          setError("No business is linked to your account yet. Ask your agency admin for access.");
          setLoading(false);
          return;
        }
        if (typeof window !== "undefined") {
          window.localStorage.setItem(CLIENT_ID_KEY, cid);
        }
        setClientId(cid);

        try {
          const profile = await apiFetch<{ success: boolean; client: ClientProfile }>(
            `/clients/${encodeURIComponent(cid)}/profile`
          );
          const c = profile.client;
          setBusinessName(c.name ?? businessName);
          setInstagramHandle(c.preferredInstagramHandle ? `@${c.preferredInstagramHandle}` : "");
          if (c.whatsappNumber) {
            setWhatsapp(c.whatsappNumber);
            setWhatsappOptIn(true);
          }
        } catch {
          // profile optional
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const hasSnapshot = useMemo(
    () => avgDailyReach != null && bestRecentReach != null && missedReach != null && missedRevenueLow != null && missedRevenueHigh != null,
    [avgDailyReach, bestRecentReach, missedReach, missedRevenueLow, missedRevenueHigh]
  );

  async function handleShowSnapshot() {
    if (!clientId) return;
    if (!businessType) {
      setError("Please pick your business type.");
      return;
    }
    if (!instagramHandle.trim()) {
      setError("Please enter your Instagram handle.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const handleClean = instagramHandle.trim().replace(/^@/, "");
      await apiFetch(`/clients/${encodeURIComponent(clientId)}/profile`, {
        method: "PATCH",
        body: JSON.stringify({
          name: businessName || undefined,
          preferredInstagramHandle: handleClean || null,
          businessType
        })
      });

      await apiFetch(`/briefing/settings`, {
        method: "PATCH",
        body: JSON.stringify({
          clientId,
          whatsappNumber: whatsappOptIn && whatsapp.trim() !== "" ? whatsapp.trim() : null
        })
      }).catch(() => {});

      const overview = await apiFetch<OverviewResponse>(
        `/analytics/${encodeURIComponent(clientId)}/overview?days=30`
      );
      const totalReach = typeof overview.totalReach === "number" ? overview.totalReach : 0;
      const days = 30;
      const avg = totalReach > 0 ? totalReach / days : 0;
      const best = totalReach > 0 ? avg * 2 : avg;
      const missedPerDay = Math.max(0, best - avg);
      const missedMonth = Math.round(missedPerDay * days);

      const revenuePerReach = 0.05;
      const low = Math.round(missedMonth * revenuePerReach * 0.5);
      const high = Math.round(missedMonth * revenuePerReach);

      setAvgDailyReach(Math.round(avg));
      setBestRecentReach(Math.round(best));
      setMissedReach(missedMonth);
      setMissedRevenueLow(low);
      setMissedRevenueHigh(high);
      setShowSnapshot(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not calculate your snapshot. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestWhatsapp() {
    if (!clientId || !whatsappOptIn || !whatsapp.trim()) return;
    try {
      await apiFetch<{ success?: boolean; briefing?: string }>(`/briefing/trigger`, {
        method: "POST",
        body: JSON.stringify({ clientId }),
        timeoutMs: 90_000
      });
    } catch {
      // ignore for now
    }
  }

  function handleFixToday() {
    trackEvent("onboarding_completed", { businessType, missedRevenueLow });
    router.replace("/dashboard?first=1");
  }

  if (loading) {
    return <ListPageSkeleton label="Loading setup…" />;
  }

  if (!clientId) {
    return (
      <div className="page-shell">
        <section className="panel span-12">
          <h2 className="text-ink font-display text-xl font-bold">Set up your business</h2>
          {error ? <p className="mt-4 text-sm text-error">{error}</p> : null}
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell max-w-xl">
      <section className="panel span-12">
        {!showSnapshot ? (
          <>
            <h1 className="text-ink font-display text-2xl font-bold tracking-tight">Tell us about your business</h1>
            <p className="text-muted mt-2 text-sm leading-relaxed">
              In under a minute, we&apos;ll show you how much Instagram growth and revenue you might be missing.
            </p>

            {error ? <p className="mt-4 text-sm text-error">{error}</p> : null}

            <div className="mt-6 space-y-6">
              <div>
                <p className="text-muted mb-2 text-xs font-semibold uppercase tracking-wide">Business type</p>
                <div className="grid grid-cols-2 gap-2">
                  {BUSINESS_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setBusinessType(type)}
                      className={`rounded-xl border px-3 py-2 text-left text-xs font-medium transition-colors ${
                        businessType === type
                          ? "border-accent-purple bg-accent-purple/20 text-white"
                          : "border-subtle bg-surface text-muted hover:border-accent-purple/40"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-muted mb-1 block text-xs font-semibold uppercase tracking-wide">
                  Instagram handle
                </label>
                <input
                  className="w-full rounded-xl border border-subtle bg-canvas px-3 py-2 text-sm text-ink"
                  value={instagramHandle}
                  onChange={(e) => setInstagramHandle(e.target.value)}
                  placeholder="@yourbusiness"
                  autoComplete="off"
                />
              </div>

              <div className="space-y-3">
                <label className="text-muted mb-1 block text-xs font-semibold uppercase tracking-wide">
                  WhatsApp number
                </label>
                <input
                  className="w-full rounded-xl border border-subtle bg-canvas px-3 py-2 text-sm text-ink"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="+91 …"
                  autoComplete="tel"
                />
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-xs text-muted">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-subtle bg-canvas"
                      checked={whatsappOptIn}
                      onChange={(e) => setWhatsappOptIn(e.target.checked)}
                    />
                    <span>Receive daily growth briefing on WhatsApp</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleTestWhatsapp()}
                    className="rounded-xl border border-subtle bg-surface px-3 py-1.5 text-xs font-medium text-white/70 hover:border-accent-teal/40 hover:text-accent-teal"
                  >
                    Send test message
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void handleShowSnapshot()}
                disabled={saving}
                className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-accent-purple px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#7a72ff] disabled:opacity-60"
              >
                {saving ? "Calculating…" : "Show me what I’m missing →"}
              </button>
            </div>
          </>
        ) : hasSnapshot ? (
          <>
            <h1 className="text-ink font-display text-2xl font-bold tracking-tight">
              {businessName || "Your business"}&apos;s Instagram snapshot
            </h1>
            <p className="text-muted mt-2 text-sm leading-relaxed">
              Here&apos;s how your current posting pattern translates into reach and missed revenue.
            </p>

            <div className="mt-6 space-y-4 rounded-2xl border border-subtle bg-[#0A0A0F] p-5">
              <div className="flex items-center justify-between text-sm text-white/80">
                <span>Your average daily reach</span>
                <span className="font-semibold">
                  {avgDailyReach != null ? avgDailyReach.toLocaleString("en-IN") : "—"} people
                </span>
              </div>
              <div className="flex items-center justify-between text-sm text-white/80">
                <span>Your best post this month</span>
                <span className="font-semibold">
                  {bestRecentReach != null ? bestRecentReach.toLocaleString("en-IN") : "—"} people reached
                </span>
              </div>
              <div className="flex items-center justify-between text-sm text-white/80">
                <span>Missed reach this month</span>
                <span className="font-semibold">
                  {missedReach != null ? missedReach.toLocaleString("en-IN") : "—"} people didn&apos;t see you
                </span>
              </div>

              <div className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-400">
                  If you continue like this for 30 days
                </p>
                <p className="mt-2 text-2xl font-bold text-white">
                  ₹{missedRevenueLow != null ? missedRevenueLow.toLocaleString("en-IN") : "—"} – ₹
                  {missedRevenueHigh != null ? missedRevenueHigh.toLocaleString("en-IN") : "—"}
                </p>
                <p className="mt-1 text-xs text-white/60">in potential revenue lost (rough estimate).</p>
              </div>

              <button
                type="button"
                onClick={handleFixToday}
                className="mt-4 w-full rounded-xl bg-red-500 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-red-400"
              >
                Fix today&apos;s loss
              </button>
              <p className="mt-2 text-center text-xs text-white/50">Takes 30 seconds with AI help.</p>
            </div>
          </>
        ) : (
          <p className="text-error text-sm">Could not calculate your snapshot. Please try again.</p>
        )}
      </section>
    </div>
  );
}

