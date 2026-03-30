"use client";

import { ChevronLeft, ChevronRight, Copy, ThumbsDown, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { getStoredToken } from "../../../lib/auth-storage";
import { usePulseSse } from "../../../hooks/usePulseSse";
import { useUserPlan } from "../../../hooks/useUserPlan";
import { UpgradeModal } from "../../../components/UpgradeModal";
import { FormToast, type FormToastVariant } from "../../../components/form-toast";
import { useExportPdf } from "../../../hooks/useExportPdf";
import { getExperimentVariant, getStoredExperimentVariant } from "../../../lib/experiment";
import { trackEvent } from "../../../lib/trackEvent";

type Metrics = {
  newFollowers?: number;
  likesYesterday?: number;
  commentsYesterday?: number;
  totalFollowers?: number;
  businessName?: string;
  dmReplies?: number;
  leadsCount?: number;
};

type RecordResponse = {
  success: boolean;
  briefing: {
    id: string;
    clientId: string;
    content: string;
    tipText: string | null;
    metricsJson: unknown;
    status: string;
    sentAt: string;
    whatsappDelivered: boolean | null;
    emailDelivered: boolean | null;
    businessName: string;
  };
  adjacent: { olderId: string | null; newerId: string | null };
  myFeedback: { tipRating: string; freeText: string | null } | null;
};

function useCountUp(target: number, durationMs: number): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / durationMs);
      setV(Math.round(target * p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return v;
}

function MetricCard({ label, value }: { label: string; value: number }) {
  const anim = useCountUp(value, 900);
  return (
    <div className="rounded-2xl border border-subtle bg-surface/80 px-4 py-4 text-center shadow-sm">
      <div className="text-muted text-xs font-semibold uppercase tracking-wide">{label}</div>
      <div className="text-ink font-display mt-2 text-3xl font-bold tabular-nums">{anim}</div>
    </div>
  );
}

export default function BriefingReaderPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === "string" ? params.id : "";
  const [data, setData] = useState<RecordResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [voteBusy, setVoteBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const userPlan = useUserPlan();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [exportLimitReached, setExportLimitReached] = useState(false);
  const [toast, setToast] = useState<{ text: string; variant: FormToastVariant } | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);
  const { exportPdf, loading: exportBusy, error: exportError, clearError: clearExportError } = useExportPdf();

  useEffect(() => {
    if (!exportError) return;
    const reached = /Free plan limit reached/i.test(exportError);
    if (reached) {
      setExportLimitReached(true);
      setShowUpgradeModal(true);
      setToast({ text: "Free limit reached. Upgrade to continue.", variant: "error" });
    } else {
      setToast({ text: exportError, variant: "error" });
    }
    clearExportError();
  }, [exportError, clearExportError]);

  const load = useCallback(async () => {
    if (!id) return;
    setError("");
    try {
      const json = await apiFetch<RecordResponse>(`/briefing/record/${encodeURIComponent(id)}`);
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load briefing");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!getStoredToken()) {
      router.replace("/login");
      return;
    }
  }, [router]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const sseClientId = data?.briefing.clientId ?? null;
  usePulseSse(sseClientId, {
    enabled: Boolean(sseClientId && id),
    onPulse: (msg) => {
      const d = msg.data;
      if (msg.type === "briefing.complete" && d && typeof d === "object" && "briefingId" in d) {
        if ((d as { briefingId?: string }).briefingId === id) void load();
      }
    }
  });

  const metrics = useMemo(() => {
    const m = data?.briefing.metricsJson;
    if (!m || typeof m !== "object") return null;
    return m as Metrics;
  }, [data]);

  async function submitFeedback(rating: "useful" | "not_helpful") {
    if (!id || voteBusy) return;
    setVoteBusy(true);
    try {
      await apiFetch(`/briefing/record/${encodeURIComponent(id)}/feedback`, {
        method: "POST",
        body: JSON.stringify({ tipRating: rating })
      });
      await load();
    } catch {
      /* toast optional */
    } finally {
      setVoteBusy(false);
    }
  }

  async function handleShare() {
    if (!id || shareBusy) return;
    if (userPlan === "free") {
      setShowUpgradeModal(true);
      return;
    }
    setShareBusy(true);
    try {
      const res = await apiFetch<{ sharePath: string }>(`/briefing/record/${encodeURIComponent(id)}/share`, {
        method: "POST",
        body: JSON.stringify({})
      });
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const full = `${origin}${res.sharePath}`;
      setShareUrl(full);
      try {
        await navigator.clipboard.writeText(full);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      } catch {
        // ignore clipboard failures
      }
    } finally {
      setShareBusy(false);
    }
  }

  async function handleExportPdf() {
    if (!briefing?.clientId || exportBusy) return;
    if (userPlan === "free" && !exportLimitReached) {
      const experimentName = "paywall_vs_pricing";
      const assignedBefore = getStoredExperimentVariant(experimentName);
      const variant = getExperimentVariant(experimentName);
      if (!assignedBefore) {
        trackEvent("experiment_assigned", {
          experiment: experimentName,
          variant,
          source: "pdf-export-paywall",
          feature: "pdf_export"
        });
      }
      if (variant === "A") {
        setShowUpgradeModal(true);
      } else {
        router.push("/pricing?source=pdf-export-paywall&feature=pdf_export");
      }
      return;
    }
    const ok = await exportPdf(briefing.clientId);
    if (ok) {
      setToast({ text: "Report exported as PDF", variant: "success" });
    }
  }

  if (loading) {
    return (
      <div className="page-shell max-w-3xl">
        <div className="skeleton mb-4 h-10 w-48 rounded-lg" />
        <div className="skeleton mb-6 h-32 w-full rounded-2xl" />
        <div className="skeleton h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page-shell max-w-3xl">
        <p className="text-error">{error || "Not found"}</p>
        <Link href="/dashboard" className="button secondary mt-4 inline-block">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const { briefing, adjacent, myFeedback } = data;
  const tip =
    briefing.tipText ??
    briefing.content.split(/[.!?]\s/)[0]?.trim() ??
    briefing.content.slice(0, 200);
  const date = new Date(briefing.sentAt).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  return (
    <div className="page-shell max-w-3xl">
      <nav className="text-muted mb-6 flex flex-wrap items-center gap-2 text-sm">
        <Link href="/dashboard" className="hover:text-ink">
          Dashboard
        </Link>
        <span aria-hidden>/</span>
        <span className="text-ink">Morning briefing</span>
      </nav>

      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent-teal">
            Your AI Growth Report
          </p>
          <h1 className="text-ink font-display mt-1 text-2xl font-bold tracking-tight md:text-3xl">
            While you slept,
            <br />
            your AI was working for you.
          </h1>
          <p className="text-muted mt-2 text-sm">
            {metrics?.dmReplies
              ? `Claude replied to ${metrics.dmReplies.toLocaleString("en-IN")} DMs and captured ${
                  metrics.leadsCount ? metrics.leadsCount.toLocaleString("en-IN") : 0
                } leads. Here’s your full picture for ${date}.`
              : `Here’s your full Instagram performance picture for ${date}.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {adjacent.olderId ? (
            <Link
              href={`/briefing/${adjacent.olderId}`}
              className="button secondary inline-flex items-center gap-1 text-sm"
            >
              <ChevronLeft size={18} aria-hidden /> Older
            </Link>
          ) : null}
          {adjacent.newerId ? (
            <Link
              href={`/briefing/${adjacent.newerId}`}
              className="button secondary inline-flex items-center gap-1 text-sm"
            >
              Newer <ChevronRight size={18} aria-hidden />
            </Link>
          ) : null}
          <button
            type="button"
            className="button secondary inline-flex items-center gap-2 text-sm"
            onClick={() => void handleShare()}
            disabled={shareBusy}
          >
            <Copy size={16} aria-hidden />
            {userPlan === "free" ? "Share (Starter only)" : shareBusy ? "…" : copied ? "Copied" : "Copy share link"}
          </button>
          <button
            type="button"
            className="button secondary inline-flex items-center gap-2 text-sm"
            onClick={() => void handleExportPdf()}
            disabled={exportBusy || exportLimitReached}
          >
            {exportBusy ? "Exporting…" : "Download Report"}
          </button>
        </div>
      </header>
      {userPlan === "free" ? (
        <p className="text-muted mb-4 text-xs">Free plan: 5 exports/month • Watermarked</p>
      ) : null}
      {exportLimitReached ? (
        <p className="text-warning mb-4 text-xs font-semibold">Upgrade to export more reports</p>
      ) : null}
      {metrics ? (
        <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricCard label="New followers (yesterday)" value={metrics.newFollowers ?? 0} />
          <MetricCard label="Likes yesterday" value={metrics.likesYesterday ?? 0} />
          <MetricCard label="Comments yesterday" value={metrics.commentsYesterday ?? 0} />
        </div>
      ) : null}

      <blockquote className="border-accent-purple/50 bg-accent-purple/10 mb-8 rounded-r-2xl border-l-4 py-5 pl-5 pr-4">
        <p className="text-muted mb-1 text-xs font-bold uppercase tracking-wide">Today&apos;s tip</p>
        <p className="text-ink font-display text-lg font-semibold leading-relaxed md:text-xl">{tip}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-muted text-xs">Was this useful?</span>
          <button
            type="button"
            className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm ${
              myFeedback?.tipRating === "useful"
                ? "border-accent-teal bg-accent-teal/15 text-accent-teal"
                : "border-subtle bg-surface"
            }`}
            disabled={voteBusy}
            onClick={() => void submitFeedback("useful")}
          >
            <ThumbsUp size={16} aria-hidden /> Helpful
          </button>
          <button
            type="button"
            className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm ${
              myFeedback?.tipRating === "not_helpful"
                ? "border-warning bg-warning/15 text-warning"
                : "border-subtle bg-surface"
            }`}
            disabled={voteBusy}
            onClick={() => void submitFeedback("not_helpful")}
          >
            <ThumbsDown size={16} aria-hidden /> Not helpful
          </button>
        </div>
      </blockquote>

      <article className="prose prose-invert mb-10 max-w-none">
        {briefing.content.split(/\n{2,}/).map((para, i) => (
          <p key={i} className="text-ink mb-4 text-base leading-relaxed">
            {para}
          </p>
        ))}
      </article>
      <div className="mb-6">
        <div className="rounded-2xl border border-accent-purple/30 bg-accent-purple/5 p-5 text-center space-y-3">
          <p className="text-sm text-ink">
            {userPlan === "free"
              ? "Share this report with your CA or business partner — upgrade to unlock share links."
              : "Share this report with your CA, business partner, or team."}
          </p>
          <button
            type="button"
            onClick={() => void handleShare()}
            className="button inline-flex items-center justify-center gap-2 text-sm"
            disabled={shareBusy}
          >
            {userPlan === "free"
              ? "🔒 Share report — Starter only"
              : copied
              ? "✓ Copied to clipboard!"
              : "🔗 Get share link"}
          </button>
          {shareUrl && userPlan !== "free" ? (
            <p className="break-all text-xs text-muted">{shareUrl}</p>
          ) : null}
          {userPlan !== "free" ? (
            <p className="text-xs text-muted">Link expires in 24 hours.</p>
          ) : null}
        </div>
      </div>

      <footer className="border-subtle text-muted rounded-xl border bg-surface/60 px-4 py-3 text-sm">
        <span className="font-semibold text-ink">Delivered</span>
        <span className="ml-2">
          WhatsApp {briefing.whatsappDelivered === true ? "✓" : briefing.whatsappDelivered === false ? "✗" : "—"}
        </span>
        <span className="mx-2">·</span>
        <span>
          Email {briefing.emailDelivered === true ? "✓" : briefing.emailDelivered === false ? "✗" : "—"}
        </span>
        <span className="mx-2">·</span>
        <span>Web view</span>
      </footer>

      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        usagePct={95}
        feature="pdf_export"
        featureName="share links"
      />
      <FormToast
        message={toast?.text ?? null}
        variant={toast?.variant ?? "success"}
        onDismiss={dismissToast}
      />
    </div>
  );
}
