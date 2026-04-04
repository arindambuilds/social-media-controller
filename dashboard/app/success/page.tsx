"use client";

/** page-enter: `usePageEnter` + `key={pathname}` on the root wrapper. */

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { usePageEnter } from "@/hooks/usePageEnter";
import { useEffect } from "react";
import { trackEvent } from "../../lib/trackEvent";
import { clearCheckoutIntent, getAttributionContext, persistAttributionFromUrl } from "../../utils/analytics";
import { getStoredExperimentVariant } from "../../lib/experiment";

export default function SuccessPage() {
  const pathname = usePathname();
  const pageClassName = usePageEnter();
  const searchParams = useSearchParams();
  const sessionId = searchParams?.get("session_id") ?? "";

  useEffect(() => {
    persistAttributionFromUrl();
    clearCheckoutIntent();
    const attribution = getAttributionContext();
    const variant = getStoredExperimentVariant("paywall_vs_pricing");
    const ctaVariant = getStoredExperimentVariant("cta_text_variant");
    trackEvent("payment_success", {
      sessionId,
      source: attribution.source,
      feature: attribution.feature
    });
    if (variant) {
      trackEvent("experiment_conversion", {
        experiment: "paywall_vs_pricing",
        variant,
        source: attribution.source,
        feature: attribution.feature,
        conversionEvent: "payment_success",
        sessionId
      });
    }
    if (ctaVariant) {
      trackEvent("experiment_conversion", {
        experiment: "cta_text_variant",
        variant: ctaVariant,
        source: attribution.source,
        feature: attribution.feature,
        conversionEvent: "payment_success",
        sessionId
      });
    }
  }, [sessionId]);

  return (
    <div key={pathname} className={`page-shell max-w-2xl ${pageClassName}`}>
      <div className="gradient-border p-6 md:p-8">
        <h1 className="font-display text-2xl font-bold text-white">Payment successful</h1>
        <p className="mt-2 text-sm text-white/60">
          Your subscription is now active. You can return to billing or continue using reports.
        </p>
        {sessionId ? <p className="mt-2 break-all text-xs text-white/35">Session: {sessionId}</p> : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/billing" className="button">
            Go to billing
          </Link>
          <Link href="/dashboard" className="button secondary">
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

