"use client";

import { AlertTriangle, MessageCircle, Percent, Play, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiFetch, fetchMe } from "../../lib/api";
import { useAuth } from "../../context/auth-context";
import { CLIENT_ID_KEY, getStoredClientId } from "../../lib/auth-storage";
import { MicroRewardToast } from "../../components/MicroRewardToast";
import { MorningBriefingCard } from "../../components/MorningBriefingCard";
import { WowCard } from "../../components/WowCard";
import { DashboardPageSkeleton } from "../../components/page-skeleton";
import { PageHeader } from "../../components/ui/page-header";
import { usePulseSse } from "../../hooks/usePulseSse";
import { useI18n } from "../../context/i18n-context";
import { ReferralCard } from "../../components/ReferralCard";
import { ShareGrowthCard } from "../../components/ShareGrowthCard";
import { trackEvent } from "../../lib/trackEvent";

type OverviewResponse = {
  followerCount?: number | null;
  instagramHandle?: string | null;
  avgEngagementRate?: number;
  totalReach?: number;
  bestHour?: number | null;
  timeSeries?: { points: Array<{ date: string; engagementRate: number }> };
  followerGrowth?: { points: Array<{ date: string; followerCount: number }> };
};

type LatestInsightResponse = {
  success?: boolean;
  insight?: { keyInsights?: string[]; actionsThisWeek?: string[] } | null;
};

function formatHour(h: number | null | undefined): string {
  if (h == null) return "—";
  const suffix = h >= 12 ? "PM" : "AM";
  const n = h % 12 === 0 ? 12 : h % 12;
  return `${n} ${suffix}`;
}

function formatShortDate(input: string): string {
  const dt = new Date(input);
  if (Number.isNaN(dt.getTime())) return input;
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function DashboardHomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, isReady } = useAuth();
  const { t } = useI18n();
  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [clientLabel, setClientLabel] = useState<string | null>(null);
  const [igConnected, setIgConnected] = useState<boolean | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  const [instagramHandle, setInstagramHandle] = useState<string | null>(null);
  const [avgEngagementRate, setAvgEngagementRate] = useState<number | null>(null);
  const [totalReach, setTotalReach] = useState<number | null>(null);
  const [bestHour, setBestHour] = useState<number | null>(null);
  const [leadsTotal, setLeadsTotal] = useState<number | null>(null);
  const [insightSummary, setInsightSummary] = useState<string | null>(null);
  const [liveConnected, setLiveConnected] = useState(false);
  const [lastActionMessage, setLastActionMessage] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [followerChart, setFollowerChart] = useState<Array<{ label: string; followers: number }>>([]);
  const [engagementChart, setEngagementChart] = useState<Array<{ label: string; ratePct: number }>>([]);

  const isFirstSession =
    searchParams?.get("first") === "1" || searchParams?.get("firstSession") === "true";
  const [showWow, setShowWow] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const seen = window.localStorage.getItem("pulse_first_session_seen");
    return isFirstSession && !seen;
  });
  const [rewardToast, setRewardToast] = useState(false);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const key =
      hour < 12 ? "assistant.greetingMorning" : hour < 17 ? "assistant.greetingAfternoon" : "assistant.greetingEvening";
    return t(key, { name: name ?? "friend" });
  }, [name, t]);

  const growthSnapshot = useMemo(() => {
    const followers = followerCount ?? null;
    const engagementPct = avgEngagementRate != null ? avgEngagementRate * 100 : null;
    return { followers, engagementPct };
  }, [followerCount, avgEngagementRate]);

  const missedReachEstimate = useMemo(() => {
    if (!totalReach || !avgEngagementRate) return null;
    const conservativeFactor = 0.15;
    const estimate = Math.round(totalReach * avgEngagementRate * conservativeFactor);
    if (!Number.isFinite(estimate) || estimate <= 0) return null;
    return estimate;
  }, [totalReach, avgEngagementRate]);

  const revenueEstimate = useMemo(() => {
    if (!missedReachEstimate || !avgEngagementRate) return null;
    const clickThrough = 0.015;
    const conversion = 0.15;
    const avgOrder = 600;
    const expectedClicks = missedReachEstimate * clickThrough;
    const expectedSales = expectedClicks * conversion;
    const low = Math.max(100, Math.round(expectedSales * (avgOrder * 0.6)));
    const high = Math.max(low + 100, Math.round(expectedSales * (avgOrder * 1.1)));
    if (!Number.isFinite(low) || !Number.isFinite(high) || high <= 0) return null;
    return { low, high };
  }, [missedReachEstimate, avgEngagementRate]);

  const missedRevenueLow = revenueEstimate?.low ?? 0;
  const missedRevenueHigh = revenueEstimate?.high ?? 0;

  const bestTimeWindow = useMemo(() => {
    if (bestHour == null) return null;
    const start = Math.max(0, bestHour - 1);
    const end = Math.min(23, bestHour + 1);
    return `${formatHour(start)}–${formatHour(end)}`;
  }, [bestHour]);

  const bestTimeIsNow = useMemo(() => {
    if (bestHour == null) return false;
    const hour = new Date().getHours();
    return Math.abs(hour - bestHour) <= 1;
  }, [bestHour]);

  const followerDelta = useMemo(() => {
    if (followerChart.length < 2) return 0;
    const last = followerChart[followerChart.length - 1]!.followers;
    const prev = followerChart[followerChart.length - 2]!.followers;
    return last - prev;
  }, [followerChart]);

  const reachChangePct = useMemo(() => {
    if (engagementChart.length < 2) return 0;
    const last = engagementChart[engagementChart.length - 1]!.ratePct;
    const prev = engagementChart[engagementChart.length - 2]!.ratePct;
    if (prev === 0) return 0;
    return ((last - prev) / Math.abs(prev)) * 100;
  }, [engagementChart]);

  function handleQuickAction(type: "post" | "caption" | "reply" | "schedule") {
    if (type === "post") {
      setLastActionMessage(t("assistant.microPraisePost"));
      router.push("/posts");
    } else if (type === "caption") {
      setLastActionMessage(t("assistant.microPraiseCaption"));
      router.push("/insights");
    } else if (type === "reply") {
      setLastActionMessage(t("assistant.microPraiseReply"));
      router.push("/dashboard/dm-inbox");
    } else {
      setLastActionMessage(t("assistant.microPraiseGeneric"));
      router.push("/posts");
    }
  }

  useEffect(() => {
    if (!isFirstSession) return;
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("pulse_first_session_seen", "1");
        if (!window.localStorage.getItem("pulse_reward_toast_seen")) {
          window.localStorage.setItem("pulse_reward_toast_seen", "1");
          setRewardToast(true);
        }
      }
      trackEvent("first_session_action", { source: "wow_card_impression" });
    } catch {
      // ignore
    }
  }, [isFirstSession]);

  useEffect(() => {
    if (!isReady) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    (async () => {
      try {
        const me = await fetchMe();
        setName(me.user.name ?? me.user.email);
        setEmail(me.user.email ?? null);
        setUserId(me.user.id);
        let cid = me.user.clientId ?? getStoredClientId();
        if (!cid && me.user.role === "AGENCY_ADMIN") {
          cid = "demo-client";
        }
        if (cid) {
          localStorage.setItem(CLIENT_ID_KEY, cid);
          setClientLabel(cid);
          setStatsLoading(true);
          try {
            const [o, leadsRes, insightRes] = await Promise.all([
              apiFetch<OverviewResponse>(`/analytics/${encodeURIComponent(cid)}/overview?days=30`),
              apiFetch<{
                success?: boolean;
                leads?: unknown[];
                total?: number;
                pagination?: { total?: number };
              }>(`/leads?clientId=${encodeURIComponent(cid)}&page=1&limit=100`),
              apiFetch<LatestInsightResponse>(
                `/insights/${encodeURIComponent(cid)}/content-performance/latest`
              ).catch(() => ({ insight: null }))
            ]);
            setFollowerCount(o.followerCount ?? null);
            setInstagramHandle(o.instagramHandle ?? null);
            setAvgEngagementRate(typeof o.avgEngagementRate === "number" ? o.avgEngagementRate : null);
            setTotalReach(typeof o.totalReach === "number" ? o.totalReach : null);
            setBestHour(typeof o.bestHour === "number" ? o.bestHour : null);

            const fg = o.followerGrowth?.points ?? [];
            setFollowerChart(
              [...fg]
                .reverse()
                .slice(-14)
                .map((p) => ({
                  label: formatShortDate(p.date),
                  followers: p.followerCount
                }))
            );

            const ts = o.timeSeries?.points ?? [];
            setEngagementChart(
              ts.slice(-14).map((p) => ({
                label: formatShortDate(p.date),
                ratePct: Math.round((p.engagementRate ?? 0) * 1000) / 10
              }))
            );

            const pTotal =
              typeof leadsRes.total === "number" ? leadsRes.total : leadsRes.pagination?.total;
            setLeadsTotal(
              typeof pTotal === "number"
                ? pTotal
                : Array.isArray(leadsRes.leads)
                  ? leadsRes.leads.length
                  : null
            );

            const keys = insightRes.insight?.keyInsights ?? [];
            setInsightSummary(keys[0] ?? insightRes.insight?.actionsThisWeek?.[0] ?? null);
          } finally {
            setStatsLoading(false);
          }
        } else {
          setClientLabel(null);
          setFollowerCount(null);
          setInstagramHandle(null);
          setAvgEngagementRate(null);
          setTotalReach(null);
          setBestHour(null);
          setLeadsTotal(null);
          setInsightSummary(null);
          setFollowerChart([]);
          setEngagementChart([]);
        }
        setIgConnected(me.instagramConnected);
      } catch {
        /* 401 → apiFetch redirects to login; transient errors keep shell */
      }
    })();
  }, [isReady, token, router]);

  usePulseSse(clientLabel, {
    enabled: Boolean(clientLabel),
    onPulse: () => {
      setLiveConnected(true);
    }
  });

  if (!isReady || !token) {
    return <DashboardPageSkeleton />;
  }

  const handleLabel = instagramHandle ? `@${instagramHandle.replace(/^@/, "")}` : null;

  return (
    <div className="page-shell">
      <MicroRewardToast show={rewardToast} onDismiss={() => setRewardToast(false)} />
      <PageHeader
        eyebrow={t("assistant.todayTitle")}
        title={greeting}
        description={
          clientLabel
            ? [
                handleLabel && `Instagram ${handleLabel}`,
                igConnected != null && (igConnected ? "Account linked" : "Connect in Accounts or Onboarding"),
                "Arома Silk House demo — saree & ethnic wear, Bhubaneswar (seeded data)."
              ]
                .filter(Boolean)
                .join(" · ")
            : "Agency view — open Analytics and pick a client, or assign a client to your user."
        }
        actions={
          liveConnected ? (
            <span className="ml-3 inline-flex items-center gap-1.5 rounded-full border border-accent-teal/40 bg-accent-teal/10 px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-accent-teal">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-teal" />
              Live
            </span>
          ) : null
        }
      />

      {email ? (
        <p className="text-muted mt-1 text-sm">
          Signed in as <strong className="text-ink font-semibold">{email}</strong>
        </p>
      ) : null}

      {showWow && missedReachEstimate != null && missedRevenueLow > 0 && missedRevenueHigh > 0 ? (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 relative">
          <button
            type="button"
            onClick={() => setShowWow(false)}
            className="absolute right-3 top-3 text-lg text-white/30 hover:text-white/60"
            aria-label="Dismiss"
          >
            ✕
          </button>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-400">
              Yesterday&apos;s missed opportunity
            </p>
            <p className="text-2xl font-bold text-white">
              ₹{missedRevenueLow.toLocaleString("en-IN")} – ₹{missedRevenueHigh.toLocaleString("en-IN")} lost
            </p>
            <p className="mt-1 text-sm text-white/60">
              {missedReachEstimate.toLocaleString("en-IN")} people didn&apos;t see your content. Don&apos;t miss today.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowWow(false);
              handleQuickAction("caption");
              trackEvent("first_session_action", { action: "caption_from_wow" });
            }}
            className="mt-1 inline-flex w-full items-center justify-center rounded-xl bg-red-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-400 sm:w-auto"
          >
            Post 1 reel now with AI help
          </button>
        </div>
      ) : null}

      {lastActionMessage ? (
        <div className="mt-3 rounded-xl border border-accent-teal/40 bg-accent-teal/10 px-4 py-2 text-xs font-semibold text-accent-teal">
          {lastActionMessage}
        </div>
      ) : null}

      {clientLabel ? (
        <section className="mt-6 space-y-4">
          <div className="gradient-border rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-accent-purple text-[0.6875rem] font-bold uppercase tracking-[0.16em]">
                  {t("assistant.growthToday")}
                </div>
                <p className="text-ink mt-1 text-sm font-semibold">
                  {growthSnapshot.followers != null || growthSnapshot.engagementPct != null
                    ? `${growthSnapshot.followers != null ? growthSnapshot.followers.toLocaleString("en-IN") : "—"} followers · ${
                        growthSnapshot.engagementPct != null ? `${growthSnapshot.engagementPct.toFixed(1)}% ER` : "—"
                      }`
                    : t("assistant.noData")}
                </p>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-subtle bg-surface text-accent-teal"
                onClick={() => handleQuickAction("caption")}
              >
                <Play size={16} strokeWidth={2} aria-hidden />
              </button>
            </div>
            <p className="text-muted mt-2 text-xs leading-relaxed">{t("assistant.todaySubtitle")}</p>
          </div>

          <ShareGrowthCard
            followerDelta={followerDelta}
            reachPct={reachChangePct}
            businessName={name ?? "Your business"}
          />

          {userId ? <ReferralCard userId={userId} /> : null}

          {bestTimeWindow ? (
            <div className="gradient-border rounded-2xl border-warning/40 bg-warning/5 p-4">
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning"
                  aria-hidden
                >
                  <AlertTriangle size={16} strokeWidth={2} />
                </span>
                <div className="flex-1">
                  <p className="text-ink text-sm font-semibold">
                    {bestTimeIsNow
                      ? t("assistant.bestTimeNow", { window: bestTimeWindow })
                      : t("assistant.bestTimeLater", { window: bestTimeWindow })}
                  </p>
                  <button
                    type="button"
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-3 py-2 text-xs font-bold text-canvas sm:w-auto"
                    onClick={() => handleQuickAction(bestTimeIsNow ? "post" : "schedule")}
                  >
                    <Play size={14} strokeWidth={2} aria-hidden />
                    {bestTimeIsNow ? t("assistant.bestTimeCtaNow") : t("assistant.bestTimeCtaLater")}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {missedReachEstimate != null ? (
            <div className="gradient-border rounded-2xl p-4">
              <p className="text-accent-purple text-[0.6875rem] font-bold uppercase tracking-[0.16em]">
                {t("assistant.missedReachTitle")}
              </p>
              <p className="text-ink mt-1 text-sm leading-relaxed">
                {t("assistant.missedReachBody", {
                  reach: missedReachEstimate.toLocaleString("en-IN")
                })}
              </p>
              {revenueEstimate ? (
                <p className="text-muted mt-1 text-xs leading-relaxed">
                  {t("assistant.revenueEstimateBody", {
                    low: revenueEstimate.low.toLocaleString("en-IN"),
                    high: revenueEstimate.high.toLocaleString("en-IN")
                  })}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="gradient-border rounded-2xl p-4">
            <p className="text-accent-teal text-[0.6875rem] font-bold uppercase tracking-[0.16em]">
              {t("assistant.aiRecommendationTitle")}
            </p>
            <p className="text-ink mt-2 text-sm leading-relaxed">
              {insightSummary ?? t("assistant.aiRecommendationEmpty")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-purple to-accent-teal px-3 py-2 text-xs font-bold text-ink shadow-glow sm:flex-none sm:px-4"
                onClick={() => handleQuickAction("caption")}
              >
                <Play size={14} strokeWidth={2} aria-hidden />
                {t("assistant.quickActionCaption")}
              </button>
              <button
                type="button"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-subtle bg-surface px-3 py-2 text-xs font-semibold text-ink sm:flex-none sm:px-4"
                onClick={() => handleQuickAction("post")}
              >
                <Play size={14} strokeWidth={2} aria-hidden />
                {t("assistant.quickActionPost")}
              </button>
            </div>
          </div>

          <div className="gradient-border rounded-2xl p-4">
            <p className="text-accent-purple text-[0.6875rem] font-bold uppercase tracking-[0.16em]">
              {t("assistant.quickActionsTitle")}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-subtle bg-surface px-3 py-3 text-xs font-semibold text-ink"
                onClick={() => handleQuickAction("caption")}
              >
                <Percent size={16} strokeWidth={2} aria-hidden />
                {t("assistant.quickActionCaption")}
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-subtle bg-surface px-3 py-3 text-xs font-semibold text-ink"
                onClick={() => handleQuickAction("reply")}
              >
                <MessageCircle size={16} strokeWidth={2} aria-hidden />
                {t("assistant.quickActionReply")}
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-subtle bg-surface px-3 py-3 text-xs font-semibold text-ink"
                onClick={() => handleQuickAction("schedule")}
              >
                <Play size={16} strokeWidth={2} aria-hidden />
                {t("assistant.quickActionSchedule")}
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-subtle bg-surface px-3 py-3 text-xs font-semibold text-ink"
                onClick={() => router.push("/onboarding")}
              >
                <UserPlus size={16} strokeWidth={2} aria-hidden />
                Invite business
              </button>
            </div>
          </div>

          {isFirstSession ? (
            <div className="mt-4">
              <WowCard animateClock />
            </div>
          ) : null}
          <MorningBriefingCard clientId={clientLabel} />
        </section>
      ) : null}

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {(
          [
            ["/analytics", "Analytics"],
            ["/insights", "Insights"],
            ["/leads", "Leads"],
            ["/posts", "Posts"],
            ["/accounts", "Accounts"],
            ["/onboarding", "Connect Instagram"]
          ] as const
        ).map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="rounded-xl border border-subtle bg-surface px-4 py-5 text-center text-sm font-bold text-ink transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-purple/40 hover:shadow-glow"
          >
            {label}
          </Link>
        ))}
      </div>

      <p className="text-muted mt-8 text-xs">
        Client ID: <code className="text-ink bg-surface rounded px-1.5 py-0.5">{getStoredClientId() ?? "—"}</code>
      </p>
    </div>
  );
}
