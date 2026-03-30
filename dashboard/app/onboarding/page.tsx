"use client";

import { BarChart3, Camera, Check, ChevronRight, Clock, Mail, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ListPageSkeleton } from "../../components/page-skeleton";
import { API_ORIGIN, apiFetch, fetchMe } from "../../lib/api";
import { CLIENT_ID_KEY, getStoredClientId, getStoredToken } from "../../lib/auth-storage";

type ClientProfile = {
  id: string;
  name: string;
  preferredInstagramHandle: string | null;
  briefingHourIst: number;
  whatsappNumber: string | null;
};

const TOTAL_STEPS = 5;

function ProgressBar({ step }: { step: number }) {
  const pct = Math.round((step / TOTAL_STEPS) * 100);
  return (
    <div className="mb-8">
      <div className="text-muted mb-2 text-sm font-medium">Step {step} of {TOTAL_STEPS}</div>
      <div className="bg-surface h-2 w-full overflow-hidden rounded-full border border-subtle">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent-purple to-accent-teal transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [ingestionMode, setIngestionMode] = useState<string | null>(null);
  const [metaConfigured, setMetaConfigured] = useState<boolean | null>(null);
  const [instagramConnected, setInstagramConnected] = useState(false);
  const [connectBusy, setConnectBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const [businessName, setBusinessName] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [briefingHour, setBriefingHour] = useState(8);

  const loadProfile = useCallback(async (cid: string) => {
    const res = await apiFetch<{ success: boolean; client: ClientProfile }>(
      `/clients/${encodeURIComponent(cid)}/profile`
    );
    const c = res.client;
    setBusinessName(c.name ?? "");
    setInstagramHandle(c.preferredInstagramHandle ?? "");
    setWhatsapp(c.whatsappNumber ?? "");
    setBriefingHour(typeof c.briefingHourIst === "number" ? c.briefingHourIst : 8);
  }, []);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    (async () => {
      try {
        const healthRes = await fetch(`${API_ORIGIN}/health`, { cache: "no-store" });
        if (healthRes.ok) {
          const h = (await healthRes.json()) as {
            ingestionMode?: string;
            instagramOAuthConfigured?: boolean;
          };
          setIngestionMode(h.ingestionMode ?? null);
          setMetaConfigured(h.instagramOAuthConfigured ?? null);
        }

        const me = await fetchMe();
        let cid = getStoredClientId() ?? me.user.clientId ?? null;
        if (me.user.role === "AGENCY_ADMIN" && !cid) {
          cid = "demo-client";
        }
        if (!cid) {
          setError("No business is linked to your account yet. Ask your agency admin for access.");
          setLoading(false);
          return;
        }
        localStorage.setItem(CLIENT_ID_KEY, cid);
        setClientId(cid);
        setEmail(me.user.email ?? "");
        setInstagramConnected(me.instagramConnected);
        await loadProfile(cid);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [router, loadProfile]);

  async function saveStep1() {
    if (!clientId || !businessName.trim()) {
      setError("Please enter your business name.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/clients/${encodeURIComponent(clientId)}/profile`, {
        method: "PATCH",
        body: JSON.stringify({
          name: businessName.trim(),
          preferredInstagramHandle: instagramHandle.trim() ? instagramHandle.trim().replace(/^@/, "") : null
        })
      });
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function saveStep2Body() {
    if (!clientId) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/briefing/settings`, {
        method: "PATCH",
        body: JSON.stringify({ clientId, whatsappNumber: whatsapp.trim() === "" ? null : whatsapp.trim() })
      });
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function saveStep3() {
    setSaving(true);
    setError("");
    try {
      if (email.trim()) {
        await apiFetch(`/auth/me`, {
          method: "PATCH",
          body: JSON.stringify({ email: email.trim() })
        });
      }
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save email");
    } finally {
      setSaving(false);
    }
  }

  async function saveStep4() {
    if (!clientId) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/clients/${encodeURIComponent(clientId)}/profile`, {
        method: "PATCH",
        body: JSON.stringify({ briefingHourIst: briefingHour })
      });
      setStep(5);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function connectInstagram() {
    setError("");
    const token = getStoredToken();
    const cid = clientId ?? getStoredClientId();
    if (!token || !cid) {
      router.push("/login");
      return;
    }
    setConnectBusy(true);
    try {
      const instagramUrl = `${API_ORIGIN}/api/auth/instagram?clientId=${encodeURIComponent(cid)}`;
      const res = await fetch(instagramUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        redirect: "manual"
      });
      const loc = res.headers.get("Location");
      if (
        (res.status === 302 || res.status === 301 || res.status === 307 || res.status === 308) &&
        loc
      ) {
        window.location.href = loc;
        return;
      }
      try {
        const data = await apiFetch<{ url: string }>(
          `/auth/oauth/instagram/authorise?clientId=${encodeURIComponent(cid)}`
        );
        window.location.href = data.url;
      } catch (e2) {
        setError(e2 instanceof Error ? e2.message : "Could not open sign-in.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open sign-in.");
    } finally {
      setConnectBusy(false);
    }
  }

  if (loading) {
    return <ListPageSkeleton label="Loading setup…" />;
  }

  if (!clientId) {
    return (
      <div className="page-shell">
        <section className="panel span-12">
          <h2 className="text-ink font-display text-xl font-bold">Set up your business</h2>
          {error ? <p className="text-error mt-4">{error}</p> : null}
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell max-w-xl">
      <section className="panel span-12">
        <h1 className="text-ink font-display text-2xl font-bold tracking-tight">Welcome — let&apos;s set things up</h1>
        <p className="text-muted mt-2 text-sm leading-relaxed">
          A few quick steps so we can send your morning summary and show your Instagram results. Plain language only — no tech jargon.
        </p>

        <ProgressBar step={step} />

        {error ? <p className="text-error mb-4 text-sm">{error}</p> : null}

        {step === 1 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-accent-purple">
              <BarChart3 size={22} aria-hidden />
              <span className="font-semibold">Your business</span>
            </div>
            <label className="block">
              <span className="text-muted text-sm">Business name</span>
              <input
                className="mt-1 w-full rounded-xl border border-subtle bg-canvas px-3 py-2 text-ink"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Green Leaf Cafe"
                autoComplete="organization"
              />
            </label>
            <label className="block">
              <span className="text-muted text-sm">Instagram username (optional for now)</span>
              <input
                className="mt-1 w-full rounded-xl border border-subtle bg-canvas px-3 py-2 text-ink"
                value={instagramHandle}
                onChange={(e) => setInstagramHandle(e.target.value)}
                placeholder="@yourhandle"
                autoComplete="off"
              />
            </label>
            <button type="button" className="button mt-2 inline-flex items-center gap-2" onClick={saveStep1} disabled={saving}>
              {saving ? "Saving…" : "Continue"}
              <ChevronRight size={18} aria-hidden />
            </button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-accent-teal">
              <MessageCircle size={22} aria-hidden />
              <span className="font-semibold">WhatsApp for morning messages</span>
            </div>
            <p className="text-muted text-sm leading-relaxed">
              Optional. Use your number with country code (e.g. +91 98765 43210) so we can send your daily Instagram summary on WhatsApp.
            </p>
            <label className="block">
              <span className="text-muted text-sm">WhatsApp number</span>
              <input
                className="mt-1 w-full rounded-xl border border-subtle bg-canvas px-3 py-2 text-ink"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+91 …"
                autoComplete="tel"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="button" onClick={() => void saveStep2Body()} disabled={saving}>
                {saving ? "Saving…" : "Continue"}
              </button>
              <button type="button" className="button secondary" onClick={() => void saveStep2Body()} disabled={saving}>
                Skip
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-accent-purple">
              <Mail size={22} aria-hidden />
              <span className="font-semibold">Email for morning briefing</span>
            </div>
            <p className="text-muted text-sm leading-relaxed">
              Optional. We send a simple email summary. You can use the same email you log in with or change it here.
            </p>
            <label className="block">
              <span className="text-muted text-sm">Email</span>
              <input
                className="mt-1 w-full rounded-xl border border-subtle bg-canvas px-3 py-2 text-ink"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="button" onClick={() => void saveStep3()} disabled={saving}>
                {saving ? "Saving…" : "Continue"}
              </button>
              <button type="button" className="button secondary" onClick={() => setStep(4)} disabled={saving}>
                Skip
              </button>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-accent-teal">
              <Clock size={22} aria-hidden />
              <span className="font-semibold">Morning briefing time</span>
            </div>
            <p className="text-muted text-sm leading-relaxed">
              Choose what hour (India time) you want your briefing. Default is 8 in the morning.
            </p>
            <label className="block">
              <span className="text-muted text-sm">Hour (0–23, India time)</span>
              <input
                className="mt-1 w-full rounded-xl border border-subtle bg-canvas px-3 py-2 text-ink"
                type="number"
                min={0}
                max={23}
                value={briefingHour}
                onChange={(e) => setBriefingHour(Number(e.target.value))}
              />
            </label>
            <button type="button" className="button" onClick={() => void saveStep4()} disabled={saving}>
              {saving ? "Saving…" : "Continue"}
            </button>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-accent-purple">
              <Camera size={22} aria-hidden />
              <span className="font-semibold">Connect Instagram</span>
            </div>
            <p className="text-muted text-sm leading-relaxed">
              Link your Instagram so we can show analytics and insights. In demo mode you can skip — sample data is already available.
            </p>
            {ingestionMode === "mock" ? (
              <p className="rounded-xl border border-subtle bg-surface/80 p-3 text-sm text-muted">
                Demo mode is on: the app uses sample data. Connect a real account when you are ready for live stats.
              </p>
            ) : null}
            {ingestionMode === "instagram" && metaConfigured === false ? (
              <p className="text-warning text-sm">Sign-in is not available until the app credentials are added on the server.</p>
            ) : null}
            {instagramConnected ? (
              <div className="flex items-center gap-2 text-accent-teal text-sm font-medium">
                <Check size={20} aria-hidden />
                Instagram is connected
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="button" onClick={() => void connectInstagram()} disabled={connectBusy}>
                {connectBusy ? "Opening sign-in…" : instagramConnected ? "Reconnect Instagram" : "Connect Instagram"}
              </button>
              <Link className="button secondary" href="/dashboard">
                {instagramConnected ? "Go to dashboard" : "Skip for now — go to dashboard"}
              </Link>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
