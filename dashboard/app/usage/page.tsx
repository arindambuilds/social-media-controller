"use client";

/** page-enter: `usePageEnter` + `key={pathname}` on the root wrapper. */

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { usePageEnter } from "@/hooks/usePageEnter";
import { UsageMeter } from "../../components/usage/UsageMeter";
import { apiFetch } from "../../lib/api";

interface PlanLimit {
  limit: number | null;
  used: number;
}

interface UsageData {
  plan: "free" | "starter" | "growth" | "agency";
  billingPeriod: { start: string; end: string };
  usage: {
    briefings: PlanLimit;
    reportExports: PlanLimit;
    voiceGenerations: PlanLimit;
    scheduledReports: PlanLimit;
    clients: PlanLimit;
  };
}

const PLAN_LABELS: Record<UsageData["plan"], string> = {
  free: "Free",
  starter: "Starter",
  growth: "Growth",
  agency: "Agency"
};

const PLAN_COLORS: Record<UsageData["plan"], string> = {
  free: "border-white/20 bg-white/5 text-white/40",
  starter: "border-cyan-400/30 bg-cyan-400/10 text-cyan-400",
  growth: "border-emerald-400/30 bg-emerald-400/10 text-emerald-400",
  agency: "border-amber-400/35 bg-amber-400/12 text-amber-100"
};

function daysRemaining(end: string) {
  const diff = new Date(end).getTime() - Date.now();
  return Math.max(Math.ceil(diff / 86400000), 0);
}

export default function UsagePage() {
  const pathname = usePathname();
  const pageClassName = usePageEnter();
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<UsageData>("/agency/usage")
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div key={pathname} className={`space-y-4 p-6 md:p-8 ${pageClassName}`}>
        <div className="h-8 w-48 animate-pulse rounded-xl bg-white/5" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div key={pathname} className={`flex h-64 items-center justify-center p-6 text-sm text-white/30 md:p-8 ${pageClassName}`}>
        Could not load usage data.
      </div>
    );
  }

  const days = daysRemaining(data.billingPeriod.end);
  const planColor = PLAN_COLORS[data.plan];
  const isNearLimit = Object.values(data.usage).some((u) => u.limit !== null && u.limit > 0 && u.used / u.limit >= 0.9);

  return (
    <div key={pathname} className={`max-w-3xl space-y-6 p-6 md:p-8 ${pageClassName}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Your usage</h1>
          <p className="mt-1 text-sm text-white/40">
            Billing period:{" "}
            {new Date(data.billingPeriod.start).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short"
            })}
            {" - "}
            {new Date(data.billingPeriod.end).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric"
            })}
            {" · "}
            <span className={days <= 5 ? "font-medium text-amber-400" : ""}>{days} days remaining</span>
          </p>
        </div>

        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${planColor}`}>
          <span className="text-xs font-bold uppercase tracking-widest">{PLAN_LABELS[data.plan]} plan</span>
        </div>
      </div>

      {isNearLimit && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-400/20 bg-red-400/8 px-4 py-3">
          <span className="shrink-0 text-lg">⚠️</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-300">You&apos;re approaching your plan limits</p>
            <p className="mt-0.5 text-xs text-red-300/60">Upgrade to avoid interruptions before your period resets.</p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-xl border border-red-400/30 bg-red-400/20 px-3 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-400/30"
          >
            Upgrade plan
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <UsageMeter
          icon="✉️"
          label="Briefings sent"
          description="AI-generated client briefings this period"
          used={data.usage.briefings.used}
          limit={data.usage.briefings.limit}
          unit="briefings"
        />
        <UsageMeter
          icon="📄"
          label="PDF reports exported"
          description="One-click and scheduled report exports"
          used={data.usage.reportExports.used}
          limit={data.usage.reportExports.limit}
          unit="reports"
        />
        <UsageMeter
          icon="🎙️"
          label="Voice generations"
          description="AI voice briefings generated"
          used={data.usage.voiceGenerations.used}
          limit={data.usage.voiceGenerations.limit}
          unit="generations"
        />
        <UsageMeter
          icon="📅"
          label="Scheduled reports"
          description="Active auto-delivery report schedules"
          used={data.usage.scheduledReports.used}
          limit={data.usage.scheduledReports.limit}
          unit="active schedules"
        />
        <UsageMeter
          icon="👥"
          label="Connected clients"
          description="Instagram accounts currently tracked"
          used={data.usage.clients.used}
          limit={data.usage.clients.limit}
          unit="clients"
        />
      </div>

      {data.plan !== "agency" && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <div>
            <p className="text-sm font-semibold text-white">
              Need more?{" "}
              {data.plan === "free"
                ? "Starter unlocks 50 briefings/month."
                : data.plan === "starter"
                  ? "Growth unlocks unlimited briefings."
                  : "Agency unlocks unlimited everything."}
            </p>
            <p className="mt-0.5 text-xs text-white/35">Upgrade anytime - prorated to your billing period.</p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-bold text-black transition-colors hover:bg-cyan-400"
          >
            View plans →
          </button>
        </div>
      )}
    </div>
  );
}
