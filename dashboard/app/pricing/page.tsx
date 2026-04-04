"use client";

/** page-enter: `usePageEnter` + `key={pathname}` on the root wrapper. */

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePageEnter } from "@/hooks/usePageEnter";
import { trackEvent } from "../../lib/trackEvent";
import { persistAttributionFromUrl } from "../../utils/analytics";

type BillingCycle = "monthly" | "yearly";
type TierId = "free" | "pro" | "business";

type Tier = {
  id: TierId;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  headline: string;
  features: string[];
  locked?: string[];
  highlighted?: boolean;
};

const TIERS: Tier[] = [
  {
    id: "free",
    name: "Free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    headline: "Start with core reporting",
    features: ["5 exports/month", "Watermarked PDFs", "Basic analytics"],
    locked: ["Branded exports", "Unlimited reports", "Priority processing"]
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: 1999,
    yearlyPrice: 15999,
    headline: "Unlock full insights and export powerful reports",
    features: ["Unlimited exports", "No watermark", "Branded reports", "Priority processing"],
    highlighted: true
  },
  {
    id: "business",
    name: "Business",
    monthlyPrice: 4999,
    yearlyPrice: 39999,
    headline: "Scale reporting across clients and teams",
    features: ["Everything in Pro", "Advanced analytics packs", "Dedicated onboarding", "Faster SLA support"]
  }
];

function formatPrice(value: number): string {
  if (value <= 0) return "Free";
  return `₹${value.toLocaleString("en-IN")}`;
}

export default function PricingPage() {
  const pathname = usePathname();
  const pageClassName = usePageEnter();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  const attributionFeature = useMemo(() => searchParams?.get("feature")?.trim() || "pricing_page", [searchParams]);
  const attributionSource = useMemo(() => searchParams?.get("source")?.trim() || "pricing-page", [searchParams]);

  useEffect(() => {
    persistAttributionFromUrl();
    trackEvent("page_view_pricing", {
      source: attributionSource,
      feature: attributionFeature
    });
  }, [attributionFeature, attributionSource]);

  function handleUpgrade(featureName: string, plan: TierId) {
    trackEvent("plan_selected", {
      source: attributionSource,
      feature: featureName,
      plan,
      cycle
    });
    trackEvent("upgrade_click", {
      source: attributionSource,
      feature: featureName,
      plan,
      cycle
    });
    router.push(`/billing?source=${encodeURIComponent(attributionSource)}&feature=${encodeURIComponent(featureName)}`);
  }

  return (
    <div key={pathname} className={`mx-auto max-w-6xl space-y-8 p-6 md:p-8 ${pageClassName}`}>
      <header className="space-y-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Pricing</p>
        <h1 className="font-display text-3xl font-bold text-white md:text-4xl">Grow faster with conversion-ready reporting</h1>
        <p className="mx-auto max-w-2xl text-sm text-white/60 md:text-base">
          Choose the plan that helps you unlock full insights, deliver premium client reports, and convert opportunities into recurring revenue.
        </p>
        <p className="text-xs text-white/45">Used by 10,000+ creators and growing businesses</p>
      </header>

      <div className="mx-auto flex w-fit rounded-xl border border-white/10 bg-white/5 p-1">
        <button
          type="button"
          onClick={() => setCycle("monthly")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            cycle === "monthly" ? "bg-cyan-500 text-black" : "text-white/65 hover:text-white"
          }`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setCycle("yearly")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            cycle === "yearly" ? "bg-cyan-500 text-black" : "text-white/65 hover:text-white"
          }`}
        >
          Yearly <span className="text-[11px] opacity-80">(save ~33%)</span>
        </button>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {TIERS.map((tier) => {
          const price = cycle === "monthly" ? tier.monthlyPrice : tier.yearlyPrice;
          return (
            <article
              key={tier.id}
              className={`relative rounded-2xl border p-5 ${
                tier.highlighted
                  ? "scale-[1.01] border-cyan-400/45 bg-cyan-400/10 shadow-[0_0_0_1px_rgba(34,211,238,.25)]"
                  : "border-white/10 bg-white/5"
              }`}
            >
              {tier.highlighted ? (
                <span className="absolute -top-2 left-4 rounded-full bg-cyan-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
                  Most Popular
                </span>
              ) : null}
              <p className="text-lg font-bold text-white">{tier.name}</p>
              <p className="mt-1 text-xs text-white/45">{tier.headline}</p>
              <p className="mt-4 text-3xl font-extrabold text-white">
                {formatPrice(price)}
                {price > 0 ? <span className="text-sm font-medium text-white/45">/{cycle === "monthly" ? "mo" : "yr"}</span> : null}
              </p>

              <ul className="mt-4 space-y-2 text-sm text-white/80">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="mt-0.5 text-emerald-400">✔</span>
                    <span>{f}</span>
                  </li>
                ))}
                {(tier.locked ?? []).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-white/45">
                    <span className="mt-0.5">🔒</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => handleUpgrade(tier.id === "free" ? "free_plan" : "pricing_upgrade", tier.id)}
                className={`mt-5 w-full rounded-xl px-4 py-3 text-sm font-bold transition ${
                  tier.id === "free"
                    ? "border border-white/15 text-white/65 hover:border-white/30 hover:text-white"
                    : "bg-cyan-500 text-black hover:bg-cyan-400"
                }`}
              >
                {tier.id === "free" ? "Stay on Free" : "Unlock full insights & export powerful reports"}
              </button>
              <p className="mt-2 text-center text-[11px] text-white/45">Cancel anytime • No hidden charges</p>
            </article>
          );
        })}
      </section>
    </div>
  );
}

