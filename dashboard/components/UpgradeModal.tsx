"use client";

import { useEffect, useMemo } from "react";
import { useState } from "react";
import { trackEvent } from "../lib/trackEvent";
import { persistAttributionFromUrl } from "../utils/analytics";
import { getExperimentVariantFromChoices, getStoredExperimentVariant } from "../lib/experiment";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  usagePct: number;
  estimatedMissedMonthlyRevenue?: number;
  feature?: string;
  featureName?: string;
  usageText?: string;
  onUpgrade?: () => void;
  continueLabel?: string;
}

type FunnelSnapshot = {
  breakdowns?: {
    byFeature?: Array<{ feature?: string; rates?: { checkoutToPaymentPct?: number } }>;
    bySource?: Array<{ source?: string; rates?: { checkoutToPaymentPct?: number } }>;
  };
};

function ctaTextForVariant(variant: "unlock_report" | "grow_faster" | "premium_insights"): string {
  if (variant === "grow_faster") return "Start Growing Faster";
  if (variant === "premium_insights") return "Access Premium Insights";
  return "Unlock Full Report";
}

export function UpgradeModal({
  open,
  onClose,
  usagePct,
  estimatedMissedMonthlyRevenue,
  feature,
  featureName,
  usageText,
  onUpgrade,
  continueLabel
}: UpgradeModalProps) {
  if (!open) return null;

  const normalizedFeature = feature ?? featureName ?? "pdf_export";
  const readableFeature = normalizedFeature
    .replace(/_/g, " ")
    .replace(/\b\w/g, (x: string) => x.toUpperCase());
  const [topFeature, setTopFeature] = useState<string | null>(null);
  const [topSource, setTopSource] = useState<string | null>(null);
  const [ctaVariant, setCtaVariant] = useState<"unlock_report" | "grow_faster" | "premium_insights">("unlock_report");

  const clampedUsage = Math.max(0, Math.min(usagePct, 100));
  const urgencyLine = useMemo(
    () => usageText ?? `You're using ${Math.max(1, Math.round((clampedUsage / 100) * 5))}/5 free exports this month`,
    [usageText, clampedUsage]
  );

  useEffect(() => {
    if (!open) return;
    persistAttributionFromUrl();
    trackEvent("paywall_impression", {
      feature: normalizedFeature,
      usagePct: clampedUsage
    });
  }, [open, normalizedFeature, clampedUsage]);

  useEffect(() => {
    if (!open) return;
    const experimentName = "cta_text_variant";
    const assignedBefore = getStoredExperimentVariant(experimentName);
    const variant = getExperimentVariantFromChoices(experimentName, [
      "unlock_report",
      "grow_faster",
      "premium_insights"
    ]) as "unlock_report" | "grow_faster" | "premium_insights";
    setCtaVariant(variant);
    if (!assignedBefore) {
      trackEvent("experiment_assigned", {
        experiment: experimentName,
        variant,
        source: `${normalizedFeature.replace(/_/g, "-")}-paywall`,
        feature: normalizedFeature
      });
    }
  }, [open, normalizedFeature]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/analytics/funnel", { method: "GET" });
        if (!res.ok) return;
        const data = (await res.json()) as FunnelSnapshot;
        if (cancelled) return;
        const featureRows = data.breakdowns?.byFeature ?? [];
        const sourceRows = data.breakdowns?.bySource ?? [];
        const bestFeature = [...featureRows].sort(
          (a, b) => (b.rates?.checkoutToPaymentPct ?? 0) - (a.rates?.checkoutToPaymentPct ?? 0)
        )[0];
        const bestSource = [...sourceRows].sort(
          (a, b) => (b.rates?.checkoutToPaymentPct ?? 0) - (a.rates?.checkoutToPaymentPct ?? 0)
        )[0];
        setTopFeature(bestFeature?.feature ?? null);
        setTopSource(bestSource?.source ?? null);

      } catch {
        // keep defaults
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    trackEvent("paywall_variant_shown", {
      feature: normalizedFeature,
      variant: ctaVariant,
      cta_text: ctaTextForVariant(ctaVariant),
      topFeature,
      topSource
    });
  }, [open, normalizedFeature, ctaVariant, topFeature, topSource]);

  const ctaText = ctaTextForVariant(ctaVariant);
  const featurePrimaryCopy =
    normalizedFeature === "pdf_export"
      ? "Download your full growth report now"
      : normalizedFeature === "ai_generations"
        ? "Generate high-performing content instantly"
        : "Unlock premium workflows for faster growth";
  const featureSocialProof =
    normalizedFeature === "pdf_export"
      ? "Most creators upgrade for this"
      : normalizedFeature === "ai_generations"
        ? "Creators use this to ship winning content daily"
        : "Trusted by teams focused on measurable growth";
  const urgencyBanner = clampedUsage >= 100 ? "You've reached your free limit" : "Free exports remaining: 1";

  function handleUpgradeClick() {
    trackEvent("upgrade_click", { usagePct: clampedUsage, feature: normalizedFeature });
    if (onUpgrade) {
      onUpgrade();
      return;
    }
    const source = encodeURIComponent(`${normalizedFeature.replace(/_/g, "-")}-paywall`);
    const featureParam = encodeURIComponent(normalizedFeature);
    window.location.href = `/billing?source=${source}&feature=${featureParam}`;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl border border-white/10 bg-[#0f111b] p-5 shadow-2xl shadow-black/50 sm:rounded-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-emerald-500/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-200">
              Pioneer · 48/50 slots
            </span>
            <span className="text-lg font-bold text-white">₹600</span>
            <span className="text-sm text-white/40 line-through">₹1,200</span>
            <span className="text-xs text-white/50">/month</span>
          </div>
          <p className="mt-2 text-sm font-semibold" style={{ color: "#00D4AA" }}>
            You saved ₹600 today
          </p>
          <p className="mt-1 text-[11px] text-white/45">Pioneer pricing for Odisha MSMEs — lock for 3 months, then ₹1,200.</p>
        </div>

        <div className="mb-5 flex items-start justify-between">
          <div className="rounded-lg border border-accent-purple/30 bg-accent-purple/10 px-2.5 py-1 text-[11px] font-semibold text-accent-purple">
            Most Popular Upgrade
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-base text-white/35 transition-colors hover:text-white/65"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <h2 className="text-xl font-bold tracking-tight text-white">Unlock Professional Reports</h2>
        <p className="mt-1 text-sm text-white/55">{featurePrimaryCopy}</p>
        <p className="mt-2 text-xs text-cyan-300/90">You&apos;re unlocking: {readableFeature}</p>
        {topFeature && topFeature === normalizedFeature ? (
          <p className="mt-2 text-xs font-semibold text-amber-300">{featureSocialProof} 🔥</p>
        ) : null}

        <ul className="mt-5 space-y-2.5 text-sm text-white/80">
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 text-emerald-400">✔</span>
            <span>Send reports to clients instantly</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 text-emerald-400">✔</span>
            <span>Remove watermark and look professional</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 text-emerald-400">✔</span>
            <span>Unlimited exports, no restrictions</span>
          </li>
        </ul>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/40">Free Plan</p>
            <ul className="mt-2 space-y-1.5 text-xs text-white/65">
              <li>5 exports/month</li>
              <li>Watermarked PDFs</li>
              <li>Basic access</li>
            </ul>
          </div>
          <div className="relative rounded-xl border border-accent-purple/40 bg-accent-purple/10 p-4 shadow-[0_0_0_1px_rgba(124,111,255,.2)]">
            <span className="absolute -top-2 left-3 rounded-full bg-accent-purple px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              Most Popular
            </span>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-purple">Pro Plan</p>
            <ul className="mt-2 space-y-1.5 text-xs text-white/85">
              <li>Unlimited exports</li>
              <li>No watermark</li>
              <li>Branded reports</li>
              <li>Priority processing</li>
            </ul>
          </div>
        </div>

        <p className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
          {urgencyBanner}
        </p>
        <p className="mt-1 text-[11px] text-white/45">{urgencyLine}</p>

        {estimatedMissedMonthlyRevenue && estimatedMissedMonthlyRevenue > 0 ? (
          <p className="mt-2 text-xs text-white/55">
            Estimated missed revenue:{" "}
            <span className="font-semibold text-red-300">₹{estimatedMissedMonthlyRevenue.toLocaleString("en-IN")}/month</span>
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleUpgradeClick}
          className="mt-5 w-full rounded-xl bg-accent-purple px-4 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#7a72ff]"
        >
          {ctaText}
        </button>
        <p className="mt-2 text-center text-[11px] text-white/45">Cancel anytime • No hidden charges</p>
        <p className="mt-3 text-center text-xs text-white/40">Trusted by growing businesses and creators</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full py-2 text-sm text-white/45 transition-colors hover:text-white/70"
        >
          {continueLabel ?? "Continue with Free Plan"}
        </button>
      </div>
    </div>
  );
}

