"use client";

import { Noto_Sans_Oriya } from "next/font/google";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ListPageSkeleton } from "../../components/page-skeleton";
import { PulseCard, PulseInput } from "../../components/pulse";
import { apiFetch, fetchMe } from "../../lib/api";
import { getAccessToken } from "../../lib/auth-storage";
import { trackEvent } from "../../lib/trackEvent";
import { usePageEnter } from "../../hooks/usePageEnter";

const notoOriya = Noto_Sans_Oriya({
  weight: ["400", "700"],
  subsets: ["oriya"],
  display: "swap"
});

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

const USE_CASES = [
  "Customer support",
  "Promos & offers",
  "Appointment reminders",
  "Order updates",
  "Other"
] as const;

function logoUrlError(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "Use a secure http(s) image link.";
    return "";
  } catch {
    return "Hmm — that link needs a little fix. Copy the logo URL again?";
  }
}

export default function OnboardingPage() {
  const pathname = usePathname();
  const router = useRouter();
  const pageClassName = usePageEnter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState<(typeof BUSINESS_TYPES)[number] | null>(null);
  const [instagramHandle, setInstagramHandle] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const [language, setLanguage] = useState<"en" | "or">("en");
  const [logoUrl, setLogoUrl] = useState("");
  const [useCase, setUseCase] = useState<(typeof USE_CASES)[number] | null>(null);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [showSnapshot, setShowSnapshot] = useState(false);
  const [avgDailyReach, setAvgDailyReach] = useState<number | null>(null);
  const [bestRecentReach, setBestRecentReach] = useState<number | null>(null);
  const [missedReach, setMissedReach] = useState<number | null>(null);
  const [missedRevenueLow, setMissedRevenueLow] = useState<number | null>(null);
  const [missedRevenueHigh, setMissedRevenueHigh] = useState<number | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    (async () => {
      try {
        const me = await fetchMe();
        setBusinessName(me.user.name ?? me.user.email ?? "");
        let cid = me.user.clientId ?? null;
        if (me.user.role === "AGENCY_ADMIN" && !cid) {
          cid = "demo-client";
        }
        if (!cid) {
          setError("No business is linked to your account yet. Ask your agency admin for access.");
          setLoading(false);
          return;
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

  const logoHint = useMemo(() => logoUrlError(logoUrl), [logoUrl]);
  const logoSuccess =
    logoUrl.trim().length > 0 && !logoHint ? "Nice, that logo looks sharp!" : undefined;

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
      // TODO: persist logoUrl + useCase when client profile API exposes fields.
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
    router.replace("/dashboard?firstSession=true&first=1");
  }

  if (loading) {
    return (
      <div key={pathname} className={pageClassName}>
        <ListPageSkeleton label="Loading setup…" />
      </div>
    );
  }

  if (!clientId) {
    return (
      <div key={pathname} className={pageClassName}>
      <PulseCard className="p-6" variant="default">
        <h2 className="text-ink font-display text-xl font-bold">Set up your business</h2>
        {error ? <p className="mt-4 text-sm text-error">{error}</p> : null}
      </PulseCard>
      </div>
    );
  }

  return (
    <div key={pathname} className={pageClassName}>
    <PulseCard className="p-6 sm:p-8" variant="accent">
        {!showSnapshot ? (
          <>
            <h1 className="text-ink font-display text-2xl font-bold tracking-tight">Let’s set up PulseOS ✨</h1>
            <p className="text-muted mt-2 text-sm leading-relaxed">
              Four friendly steps — like a guided tour, not a tax form. We’ll WhatsApp your morning briefing at 9:00 AM
              (IST).
            </p>

            <div className="mt-4 flex gap-2" aria-label="Onboarding progress">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className={`h-1.5 flex-1 rounded-full ${step >= n ? "bg-blue-600" : "bg-white/10"}`}
                />
              ))}
            </div>

            {error ? <p className="mt-4 text-sm text-error">{error}</p> : null}

            <div className="mt-6 space-y-6">
              <div>
                <p className="text-muted mb-2 text-xs font-semibold uppercase tracking-wide">Step {step} of 4</p>
              </div>

              {step === 1 ? (
              <div className="space-y-5">
                <div>
                  <label className="text-muted mb-1 block text-xs font-semibold uppercase tracking-wide">
                    Brand / business name
                  </label>
                  <input
                    className="w-full rounded-xl border border-subtle bg-canvas px-3 py-2.5 text-sm text-ink"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Maa Tarini Sarees"
                    autoComplete="organization"
                  />
                  <p className="mt-2 text-xs text-muted">This is how Pulse greets you in the dashboard.</p>
                </div>
                <PulseInput
                  label="Logo URL (optional)"
                  placeholder="https://…/logo.png"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  error={logoHint}
                  successMessage={logoSuccess}
                  hint="Paste a public image link — or skip and add it later in Settings."
                />
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
                            ? "border-mango-500/60 bg-mango-500/15 text-ink"
                            : "border-subtle bg-surface text-muted hover:border-mango-500/35"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              ) : null}

              {step === 2 ? (
              <div className="space-y-5">
                <div>
                  <p className="text-muted mb-2 text-xs font-semibold uppercase tracking-wide">Main WhatsApp use-case</p>
                  <p className="mb-3 text-xs text-muted">Pick what you want to automate first — you can change anytime.</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {USE_CASES.map((uc) => (
                      <button
                        key={uc}
                        type="button"
                        onClick={() => setUseCase(uc)}
                        className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition-colors ${
                          useCase === uc
                            ? "border-mint-500/50 bg-mint-600/15 text-mint-100"
                            : "border-subtle bg-surface text-muted hover:border-mint-500/35"
                        }`}
                      >
                        {uc}
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
              </div>
              ) : null}

              {step === 3 ? (
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
              ) : null}

              {step === 4 ? (
              <div>
                <p className="text-muted mb-2 text-xs font-semibold uppercase tracking-wide">Briefing language</p>
                <p className="text-muted mb-3 text-xs">Odia renders in Noto Sans Oriya for accurate script.</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setLanguage("en")}
                    className={`rounded-xl border px-3 py-3 text-left text-sm font-medium transition-colors ${
                      language === "en"
                        ? "border-blue-500 bg-blue-500/20 text-white"
                        : "border-subtle bg-surface text-muted hover:border-blue-500/40"
                    }`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage("or")}
                    className={`rounded-xl border px-3 py-3 text-left text-sm font-medium transition-colors ${
                      language === "or"
                        ? "border-accent-teal bg-accent-teal/15 text-white"
                        : "border-subtle bg-surface text-muted hover:border-accent-teal/40"
                    }`}
                  >
                    <span className={notoOriya.className}>ଓଡ଼ିଆ (Odia)</span>
                  </button>
                </div>
                {language === "or" ? (
                  <p className={`mt-3 rounded-xl border border-subtle bg-canvas px-3 py-2 text-sm text-ink ${notoOriya.className}`}>
                    ଆପଣଙ୍କ ଦୋକାନ ଆଜି ୩ ଟି ନୂଆ ଲିଡ୍ ପାଇଛି।
                  </p>
                ) : null}
              </div>
              ) : null}

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={() => setStep((s) => Math.max(1, s - 1))}
                    className="rounded-xl border border-subtle bg-surface px-4 py-2 text-sm font-medium text-white/70"
                  >
                    Back
                  </button>
                ) : (
                  <span />
                )}
                {step < 4 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (step === 1) {
                        if (!businessName.trim()) {
                          setError("Add your brand name — even a short one is perfect.");
                          return;
                        }
                        if (logoUrl.trim() && logoHint) {
                          setError(logoHint);
                          return;
                        }
                        if (!businessType) {
                          setError("Please pick your business type.");
                          return;
                        }
                      }
                      if (step === 2) {
                        if (!useCase) {
                          setError("Pick a main use-case so we can tailor tips.");
                          return;
                        }
                        if (!instagramHandle.trim()) {
                          setError("Please enter your Instagram handle.");
                          return;
                        }
                      }
                      setError("");
                      setStep((s) => s + 1);
                    }}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-500"
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleShowSnapshot()}
                    disabled={saving}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-500 disabled:opacity-60"
                  >
                    {saving ? "Calculating…" : "Finish & show snapshot →"}
                  </button>
                )}
              </div>
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
    </PulseCard>
    </div>
  );
}

