"use client";

/** page-enter: `usePageEnter` + `key={pathname}` on the root wrapper. */

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { usePageEnter } from "@/hooks/usePageEnter";

type StepCounts = {
  paywall_impression: number;
  upgrade_click: number;
  checkout_started: number;
  payment_success: number;
};

type BreakdownRow = {
  feature?: string;
  source?: string;
  counts: StepCounts;
  rates: {
    paywallToClickPct: number;
    clickToCheckoutPct: number;
    checkoutToPaymentPct: number;
  };
  revenue: number;
};

type FunnelResponse = {
  totals: StepCounts & {
    rates: {
      paywallToClickPct: number;
      clickToCheckoutPct: number;
      checkoutToPaymentPct: number;
    };
    revenue: number;
  };
  breakdowns: {
    byFeature: BreakdownRow[];
    bySource: BreakdownRow[];
  };
  revenue: {
    total: number;
    perFeature: Record<string, number>;
    topConvertingFeature: string | null;
  };
  experiments?: Record<
    string,
    Record<
      string,
      {
        assigned: number;
        conversions: number;
        conversionRatePct: number;
      }
    >
  >;
  insights: string[];
};

type FunnelStubResponse = {
  stages: Array<{ label: string; count: number }>;
  message?: string;
};

function isFunnelResponse(payload: unknown): payload is FunnelResponse {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      "totals" in payload &&
      "breakdowns" in payload &&
      "revenue" in payload
  );
}

function fmtPct(v: number): string {
  return `${v.toFixed(1)}%`;
}

function fmtInr(v: number): string {
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

function FunnelStep({ label, value, pct }: { label: string; value: number; pct?: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/45">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value.toLocaleString("en-IN")}</p>
      {typeof pct === "number" ? <p className="mt-1 text-xs text-cyan-300">{fmtPct(pct)}</p> : null}
    </div>
  );
}

export default function GrowthAnalyticsDashboardPage() {
  const pathname = usePathname();
  const pageClassName = usePageEnter();
  const [data, setData] = useState<FunnelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [comingSoonMessage, setComingSoonMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/analytics/funnel", {
          method: "GET",
          credentials: "include",
          cache: "no-store"
        });
        const payload = (await response.json().catch(() => ({}))) as FunnelResponse | FunnelStubResponse;
        if (!response.ok) {
          throw new Error("Could not load funnel data");
        }
        if (!cancelled) {
          if (isFunnelResponse(payload)) {
            setData(payload);
            setComingSoonMessage("");
          } else {
            setData(null);
            setComingSoonMessage(payload.message?.trim() || "Funnel analytics coming soon.");
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load funnel data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const topFeature = useMemo(() => data?.revenue.topConvertingFeature ?? "—", [data]);
  const experimentCards = useMemo(() => {
    const exp = data?.experiments ?? {};
    const keys = ["paywall_vs_pricing", "cta_text_variant"];
    return keys.map((experiment) => {
      const variants = Object.entries(exp[experiment] ?? {});
      return { experiment, variants };
    });
  }, [data]);

  if (loading) {
    return (
      <div key={pathname} className={`space-y-4 p-6 md:p-8 ${pageClassName}`}>
        <div className="h-8 w-64 animate-pulse rounded-lg bg-white/5" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  if (comingSoonMessage) {
    return (
      <div key={pathname} className={`p-6 md:p-8 ${pageClassName}`}>
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <h1 className="font-display text-2xl font-bold text-white">Growth Funnel Analytics</h1>
          <p className="mt-2 text-sm text-white/55">{comingSoonMessage}</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div key={pathname} className={`p-6 md:p-8 ${pageClassName}`}>
        <p className="text-sm text-red-300">{error || "No funnel data available."}</p>
      </div>
    );
  }

  return (
    <div key={pathname} className={`space-y-6 p-6 md:p-8 ${pageClassName}`}>
      <header>
        <h1 className="font-display text-2xl font-bold text-white">Growth Funnel Analytics</h1>
        <p className="mt-1 text-sm text-white/55">Conversion rates, drop-offs, and revenue performance by feature and source.</p>
      </header>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <FunnelStep label="Paywall impressions" value={data.totals.paywall_impression} />
        <FunnelStep label="Upgrade clicks" value={data.totals.upgrade_click} pct={data.totals.rates.paywallToClickPct} />
        <FunnelStep
          label="Checkout started"
          value={data.totals.checkout_started}
          pct={data.totals.rates.clickToCheckoutPct}
        />
        <FunnelStep
          label="Payments"
          value={data.totals.payment_success}
          pct={data.totals.rates.checkoutToPaymentPct}
        />
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-white/45">Total revenue</p>
          <p className="mt-2 text-2xl font-bold text-emerald-300">{fmtInr(data.revenue.total)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-white/45">Top converting feature</p>
          <p className="mt-2 text-2xl font-bold text-cyan-300">{topFeature}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-white/45">Checkout → Payment</p>
          <p className="mt-2 text-2xl font-bold text-white">{fmtPct(data.totals.rates.checkoutToPaymentPct)}</p>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-base font-semibold text-white">Breakdown by Feature</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/45">
                <th className="py-2 pr-3">Feature</th>
                <th className="py-2 pr-3">Impressions</th>
                <th className="py-2 pr-3">Click %</th>
                <th className="py-2 pr-3">Checkout %</th>
                <th className="py-2 pr-3">Payment %</th>
                <th className="py-2">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.breakdowns.byFeature.map((row) => (
                <tr key={row.feature ?? "unknown"} className="border-b border-white/5 text-white/85">
                  <td className="py-2 pr-3">{row.feature ?? "unknown"}</td>
                  <td className="py-2 pr-3">{row.counts.paywall_impression}</td>
                  <td className="py-2 pr-3">{fmtPct(row.rates.paywallToClickPct)}</td>
                  <td className="py-2 pr-3">{fmtPct(row.rates.clickToCheckoutPct)}</td>
                  <td className="py-2 pr-3">{fmtPct(row.rates.checkoutToPaymentPct)}</td>
                  <td className="py-2 text-emerald-300">{fmtInr(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-base font-semibold text-white">Breakdown by Source</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/45">
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3">Impressions</th>
                <th className="py-2 pr-3">Click %</th>
                <th className="py-2 pr-3">Checkout %</th>
                <th className="py-2 pr-3">Payment %</th>
                <th className="py-2">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.breakdowns.bySource.map((row) => (
                <tr key={row.source ?? "unknown"} className="border-b border-white/5 text-white/85">
                  <td className="py-2 pr-3">{row.source ?? "unknown"}</td>
                  <td className="py-2 pr-3">{row.counts.paywall_impression}</td>
                  <td className="py-2 pr-3">{fmtPct(row.rates.paywallToClickPct)}</td>
                  <td className="py-2 pr-3">{fmtPct(row.rates.clickToCheckoutPct)}</td>
                  <td className="py-2 pr-3">{fmtPct(row.rates.checkoutToPaymentPct)}</td>
                  <td className="py-2 text-emerald-300">{fmtInr(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-4">
        <h2 className="text-base font-semibold text-cyan-200">Dynamic insights</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-cyan-100">
          {data.insights.map((insight) => (
            <li key={insight}>{insight}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-base font-semibold text-white">Experiment Performance</h2>
        <p className="mt-1 text-xs text-white/45">Assignment count, conversion count, and CVR by variant.</p>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {experimentCards.map(({ experiment, variants }) => (
            <article key={experiment} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-sm font-semibold text-white">{experiment}</h3>
              {variants.length === 0 ? (
                <p className="mt-2 text-xs text-white/45">No data yet.</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[360px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-white/45">
                        <th className="py-2 pr-3">Variant</th>
                        <th className="py-2 pr-3">Assigned</th>
                        <th className="py-2 pr-3">Conversions</th>
                        <th className="py-2">CVR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variants.map(([variant, stats]) => (
                        <tr key={`${experiment}-${variant}`} className="border-b border-white/5 text-white/85">
                          <td className="py-2 pr-3">{variant}</td>
                          <td className="py-2 pr-3">{stats.assigned.toLocaleString("en-IN")}</td>
                          <td className="py-2 pr-3">{stats.conversions.toLocaleString("en-IN")}</td>
                          <td className="py-2 text-cyan-300">{fmtPct(stats.conversionRatePct)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

