"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { trackEvent } from "../../lib/trackEvent";
import {
  getAttributionContext,
  getCheckoutIntent,
  persistAttributionFromUrl,
  setCheckoutIntent
} from "../../utils/analytics";
import { getStoredToken } from "../../lib/auth-storage";

interface Plan {
  id: "free" | "starter" | "growth" | "agency";
  name: string;
  price: number;
  stripePriceId: string;
  features: string[];
  limits: {
    briefings: number | null;
    clients: number | null;
    reports: number | null;
  };
}

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    stripePriceId: "",
    features: ["1 client", "5 briefings/month", "3 PDF exports", "Basic analytics"],
    limits: { briefings: 5, clients: 1, reports: 3 }
  },
  {
    id: "starter",
    name: "Starter",
    price: 1999,
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID ?? "",
    features: ["5 clients", "50 briefings/month", "20 PDF exports", "Scheduled reports (3)", "Email support"],
    limits: { briefings: 50, clients: 5, reports: 20 }
  },
  {
    id: "growth",
    name: "Growth",
    price: 4999,
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_GROWTH_PRICE_ID ?? "",
    features: ["15 clients", "Unlimited briefings", "100 PDF exports", "Scheduled reports (10)", "Voice briefings", "Priority support"],
    limits: { briefings: null, clients: 15, reports: 100 }
  },
  {
    id: "agency",
    name: "Agency",
    price: 9999,
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_AGENCY_PRICE_ID ?? "",
    features: ["Unlimited clients", "Unlimited everything", "White-label reports", "Dedicated support", "Custom integrations"],
    limits: { briefings: null, clients: null, reports: null }
  }
];

const PLAN_ACCENTS: Record<string, string> = {
  free: "border-white/15",
  starter: "border-cyan-400/40",
  growth: "border-emerald-400/40",
  agency: "border-purple-400/40"
};

const PLAN_BADGE: Record<string, string> = {
  free: "bg-white/8 text-white/50",
  starter: "bg-cyan-400/15 text-cyan-400",
  growth: "bg-emerald-400/15 text-emerald-400",
  agency: "bg-purple-400/15 text-purple-400"
};

export default function BillingPage() {
  const searchParams = useSearchParams();
  const [currentPlan, setCurrentPlan] = useState<string>("free");
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [portalLoading, setPortal] = useState(false);
  const [attribution, setAttribution] = useState<{ source?: string; feature?: string }>({});
  const [showCheckoutReminder, setShowCheckoutReminder] = useState(false);
  const [topConvertingFeature, setTopConvertingFeature] = useState<string | null>(null);

  useEffect(() => {
    const fromUrl = persistAttributionFromUrl();
    const fromStore = getAttributionContext();
    const ctx = {
      source: fromUrl.source ?? fromStore.source,
      feature: fromUrl.feature ?? fromStore.feature
    };
    setAttribution(ctx);
    trackEvent("billing_page_view", {
      source: ctx.source,
      feature: ctx.feature,
      params: { source: searchParams?.get("source") ?? null, feature: searchParams?.get("feature") ?? null }
    });

    apiFetch<{ plan?: string }>("/agency/usage")
      .then((d) => {
        setCurrentPlan(d.plan ?? "free");
        setLoading(false);
      })
      .catch(() => setLoading(false));
    void fetch("/api/analytics/funnel")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { revenue?: { topConvertingFeature?: string | null } } | null) => {
        if (d?.revenue?.topConvertingFeature) setTopConvertingFeature(d.revenue.topConvertingFeature);
      })
      .catch(() => {});
  }, [searchParams]);

  useEffect(() => {
    const intent = getCheckoutIntent();
    if (!intent) return;
    const elapsed = Date.now() - intent.startedAt;
    const thresholdMs = 5 * 60 * 1000;
    if (elapsed >= thresholdMs) {
      setShowCheckoutReminder(true);
      if (!intent.abandonedTracked) {
        trackEvent("checkout_abandoned", {
          source: intent.source ?? attribution.source,
          feature: intent.feature ?? attribution.feature,
          planId: intent.planId,
          elapsedMs: elapsed
        });
        setCheckoutIntent({
          ...intent,
          abandonedTracked: true,
          startedAt: intent.startedAt
        });
      }
      return;
    }
    const remaining = thresholdMs - elapsed;
    const timeout = window.setTimeout(() => {
      const fresh = getCheckoutIntent();
      if (!fresh) return;
      setShowCheckoutReminder(true);
      if (!fresh.abandonedTracked) {
        trackEvent("checkout_abandoned", {
          source: fresh.source ?? attribution.source,
          feature: fresh.feature ?? attribution.feature,
          planId: fresh.planId,
          elapsedMs: Date.now() - fresh.startedAt
        });
        setCheckoutIntent({
          ...fresh,
          abandonedTracked: true,
          startedAt: fresh.startedAt
        });
      }
    }, remaining);
    return () => window.clearTimeout(timeout);
  }, [attribution.feature, attribution.source]);

  const handleUpgrade = async (plan: Plan) => {
    if (!plan.stripePriceId || plan.id === currentPlan) return;
    setUpgrading(plan.id);
    try {
      trackEvent("checkout_started", {
        source: attribution.source ?? "billing",
        feature: attribution.feature ?? "plans",
        planId: plan.id,
        priceId: plan.stripePriceId
      });
      setCheckoutIntent({
        source: attribution.source ?? "billing",
        feature: attribution.feature ?? "plans",
        planId: plan.id
      });
      const token = getStoredToken();
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          priceId: plan.stripePriceId,
          source: attribution.source ?? "billing",
          feature: attribution.feature ?? "plans"
        })
      });
      if (!res.ok) {
        throw new Error("Could not start checkout. Please try again.");
      }
      const data = (await res.json()) as { url?: string };
      const url = data.url;
      if (url) window.location.href = url;
    } catch {
      alert("Could not start checkout. Please try again.");
    } finally {
      setUpgrading(null);
    }
  };

  const handlePortal = async () => {
    setPortal(true);
    try {
      const { url } = await apiFetch<{ url?: string }>("/billing/portal", { method: "POST" });
      if (url) window.location.href = url;
    } catch {
      alert("Could not open billing portal.");
    } finally {
      setPortal(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2 md:p-8 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-80 animate-pulse rounded-2xl bg-white/5" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Plans & billing</h1>
          <p className="mt-1 text-sm text-white/40">Upgrade or downgrade anytime - changes take effect immediately.</p>
          {attribution.feature ? (
            <p className="mt-1 text-xs text-cyan-300/90">Upgrading from: {attribution.feature}</p>
          ) : null}
          {searchParams?.get("canceled") === "true" ? (
            <p className="mt-1 text-xs text-amber-300/90">Checkout canceled. You can continue whenever ready.</p>
          ) : null}
        </div>
        {currentPlan !== "free" && (
          <button
            onClick={handlePortal}
            disabled={portalLoading}
            className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white/50 transition-all hover:border-white/30 hover:text-white/80 disabled:opacity-40"
          >
            {portalLoading ? "Opening..." : "Manage subscription →"}
          </button>
        )}
      </div>
      {showCheckoutReminder ? (
        <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          Complete your upgrade to unlock your report.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const isDowngrade = PLANS.findIndex((p) => p.id === plan.id) < PLANS.findIndex((p) => p.id === currentPlan);

          const isTopFeaturePlan =
            (topConvertingFeature === "pdf_export" && plan.id === "starter") ||
            (topConvertingFeature === "ai_generations" && plan.id === "growth");

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col space-y-4 rounded-2xl border p-5 transition-all ${
                isCurrent ? `${PLAN_ACCENTS[plan.id]} bg-white/[0.06]` : "border-white/10 bg-white/5 hover:border-white/20"
              }`}
            >
              {isCurrent && (
                <div
                  className={`absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${PLAN_BADGE[plan.id]}`}
                >
                  Current
                </div>
              )}
              {isTopFeaturePlan ? (
                <div className="absolute left-3 top-3 rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-300">
                  🔥 Most upgraded feature
                </div>
              ) : null}

              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white">{plan.name}</h2>
                {plan.price === 0 ? (
                  <p className="text-sm text-white/40">Free forever</p>
                ) : (
                  <p className="text-sm text-white">
                    <span className="text-2xl font-bold">₹{plan.price.toLocaleString("en-IN")}</span>
                    <span className="text-white/40">/month</span>
                  </p>
                )}
              </div>

              <ul className="flex-1 space-y-2">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-white/60">
                    <span className={`mt-0.5 shrink-0 ${isCurrent ? "text-cyan-400" : "text-white/25"}`}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleUpgrade(plan)}
                disabled={isCurrent || upgrading === plan.id || plan.id === "free"}
                className={`w-full rounded-xl py-2.5 text-sm font-bold transition-all disabled:opacity-40 ${
                  isCurrent
                    ? "cursor-default bg-white/8 text-white/40"
                    : isDowngrade
                      ? "border border-white/15 text-white/50 hover:border-white/30 hover:text-white/70"
                      : "bg-cyan-500 text-black hover:bg-cyan-400"
                }`}
              >
                {upgrading === plan.id
                  ? "Redirecting..."
                  : isCurrent
                    ? "Current plan"
                    : plan.id === "free"
                      ? "Downgrade via portal"
                      : isDowngrade
                        ? "Downgrade"
                        : "Upgrade →"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-white/8 bg-white/[0.03] p-5 text-xs text-white/45 md:grid-cols-3">
        <div>
          <p className="mb-1 font-semibold text-white/70">When does billing start?</p>
          Immediately on upgrade. Your first charge is prorated to the remaining days in the current month.
        </div>
        <div>
          <p className="mb-1 font-semibold text-white/70">Can I cancel anytime?</p>
          Yes - cancel via "Manage subscription". Your plan stays active until the end of the billing period.
        </div>
        <div>
          <p className="mb-1 font-semibold text-white/70">What happens to my data?</p>
          Downgrading never deletes historical data. You keep full read access, just with lower limits going forward.
        </div>
      </div>
    </div>
  );
}
