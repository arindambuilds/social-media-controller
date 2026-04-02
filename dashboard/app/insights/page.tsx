"use client";

import { Brain, Copy, Loader2, Sparkles, Target, ThumbsDown, ThumbsUp, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, apiFetchResponse, fetchMe, type CaptionCard } from "../../lib/api";
import { trackEvent } from "../../lib/trackEvent";
import { CLIENT_ID_KEY, getStoredClientId, getStoredToken } from "../../lib/auth-storage";
import { PageHeader } from "../../components/ui/page-header";
import { UpgradeModal } from "../../components/UpgradeModal";

type InsightPayload = {
  id: string;
  /** Full narrative from the model / deterministic baseline. */
  summary?: string;
  keyInsights: string[];
  actionsThisWeek: string[];
  warning: string | null;
  userFeedback: number | null;
  generatedAt: string;
};

type LatestResponse = {
  success: boolean;
  insight: InsightPayload | null;
  cooldownRemainingSeconds: number;
};

const TONES = ["Friendly", "Professional", "Playful", "Urgent"] as const;

function InsightList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((k) => (
        <li
          key={k.slice(0, 48)}
          className="border-accent-teal/25 text-ink relative border-l-2 pl-4 text-sm leading-relaxed"
        >
          {k}
        </li>
      ))}
    </ul>
  );
}

export default function InsightsPage() {
  const router = useRouter();
  const [clientId, setClientId] = useState<string | null>(null);
  const [insight, setInsight] = useState<InsightPayload | null>(null);
  const [cooldownRemainingSeconds, setCooldownRemainingSeconds] = useState(0);
  const [loadingLatest, setLoadingLatest] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const [tone, setTone] = useState<string>(TONES[0]);
  const [goal, setGoal] = useState("Grow bookings from Instagram");
  const [offer, setOffer] = useState("");
  const [captions, setCaptions] = useState<CaptionCard[]>([]);
  const [captionLoading, setCaptionLoading] = useState(false);
  const [billing, setBilling] = useState<{ generationsUsed: number; generationsLimit: number } | null>(null);
  const [weeklyFocus, setWeeklyFocus] = useState<string | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [rewardMessage, setRewardMessage] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeUsagePct, setUpgradeUsagePct] = useState(0);

  const refreshLatest = useCallback(async (cid: string) => {
    const data = await apiFetch<LatestResponse>(
      `/insights/${encodeURIComponent(cid)}/content-performance/latest`
    );
    setInsight(data.insight);
    setCooldownRemainingSeconds(data.cooldownRemainingSeconds);
  }, []);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    (async () => {
      try {
        let cid = getStoredClientId();
        const me = await fetchMe();
        cid = cid ?? me.user.clientId ?? null;
        if (!cid && me.user.role === "AGENCY_ADMIN") {
          cid = "demo-client";
        }
        if (cid) localStorage.setItem(CLIENT_ID_KEY, cid);
        if (!cid) {
          setError("No client ID for this account.");
          setLoadingLatest(false);
          return;
        }
        setClientId(cid);
        await refreshLatest(cid);
        try {
          const b = await apiFetch<{ generationsUsed: number; generationsLimit: number }>(
            `/billing/${encodeURIComponent(cid)}/status`
          );
          setBilling(b);
        } catch {
          setBilling(null);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoadingLatest(false);
      }
    })();
  }, [router, refreshLatest]);

  useEffect(() => {
    if (!billing) return;
    const { generationsUsed, generationsLimit } = billing;
    if (!generationsLimit || generationsLimit <= 0) return;
    const pct = Math.round((generationsUsed / generationsLimit) * 100);
    setUpgradeUsagePct(pct);
    if (pct > 80) setShowUpgrade(true);
  }, [billing]);

  useEffect(() => {
    if (!cooldownRemainingSeconds) return;
    const t = setInterval(() => {
      setCooldownRemainingSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [cooldownRemainingSeconds > 0]);

  async function generateInsightFlow() {
    if (!clientId) return;
    setError("");
    setGenerating(true);
    try {
      const res = await apiFetchResponse(
        `/insights/${encodeURIComponent(clientId)}/content-performance/generate`,
        {
          method: "POST",
          body: JSON.stringify({}),
          /** OpenAI + DB can exceed default 10s on cold Render / slow networks. */
          timeoutMs: 90_000
        }
      );
      const raw = await res.text();
      let body: Record<string, unknown> = {};
      if (raw) {
        try {
          body = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          body = {};
        }
      }
      if (res.status === 429) {
        const c = body.cooldownRemainingSeconds;
        setCooldownRemainingSeconds(typeof c === "number" ? c : 0);
        return;
      }
      if (!res.ok) {
        const detail = typeof body.detail === "string" ? body.detail : undefined;
        const err = typeof body.error === "string" ? body.error : undefined;
        setError((detail ?? err ?? raw.slice(0, 200)) || `HTTP ${res.status}`);
        return;
      }
      const data = body as unknown as LatestResponse;
      if (!data.insight) {
        setError("Insight did not return data — try again.");
        return;
      }
      setInsight(data.insight);
      setCooldownRemainingSeconds(data.cooldownRemainingSeconds);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setGenerating(false);
    }
  }

  async function postFeedback(vote: "up" | "down") {
    if (!clientId || !insight) return;
    try {
      await apiFetch(`/insights/${encodeURIComponent(clientId)}/${encodeURIComponent(insight.id)}/feedback`, {
        method: "POST",
        body: JSON.stringify({ vote })
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Feedback failed");
      return;
    }
    setInsight((prev) =>
      prev ? { ...prev, userFeedback: vote === "up" ? 1 : -1 } : prev
    );
  }

  async function generateWeeklyFocus() {
    if (!clientId) return;
    setWeeklyLoading(true);
    setError("");
    try {
      const data = await apiFetch<{ text?: string }>(
        `/ai/recommendations/weekly/${encodeURIComponent(clientId)}`,
        {
          method: "POST"
        }
      );
      setWeeklyFocus(typeof data.text === "string" ? data.text : "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Weekly focus failed");
    } finally {
      setWeeklyLoading(false);
    }
  }

  async function generateCaptions() {
    if (!clientId) return;
    setCaptionLoading(true);
    setCaptions([]);
    setError("");
    try {
      const data = await apiFetch<{ captions: CaptionCard[] }>(
        `/ai/${encodeURIComponent(clientId)}/captions/generate`,
        {
          method: "POST",
          body: JSON.stringify({ tone, goal, offer: offer || undefined })
        }
      );
      setCaptions(Array.isArray(data.captions) ? data.captions : []);
      setRewardMessage("Caption ready! Your audience will love this. 🎯");
      trackEvent("caption_generated", { clientId, tone, goal });
      window.setTimeout(() => setRewardMessage(null), 3000);
      try {
        const b = await apiFetch<{ generationsUsed: number; generationsLimit: number }>(
          `/billing/${encodeURIComponent(clientId)}/status`
        );
        setBilling(b);
      } catch {
        /* billing optional */
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Caption generation failed");
    } finally {
      setCaptionLoading(false);
    }
  }

  function copyText(text: string) {
    void navigator.clipboard.writeText(text);
  }

  if (loadingLatest) {
    return (
      <div className="page-shell">
        <div className="gradient-border p-6">
          <div className="flex items-center gap-3">
            <div className="spinner" aria-label="Loading insights" />
            <span className="text-muted text-sm">Loading AI insights…</span>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-32 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && !clientId) {
    return (
      <div className="page-shell">
        <PageHeader eyebrow="AI" title="Insights" description="Content performance and caption ideas for this client." />
        <p className="text-error mt-6">{error}</p>
      </div>
    );
  }

  const missedMonthlyRevenue = 0;

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="AI"
        title="Insights"
        description="Generate performance summaries, a weekly focus line, and on-brand captions — all scoped to this client."
      />

      {error ? <p className="text-error mt-4">{error}</p> : null}

      <section className="mt-10 space-y-10">
        <div className="gradient-border p-6 sm:p-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-accent-purple/35 bg-gradient-to-br from-accent-purple/20 to-accent-teal/15 text-accent-purple"
                aria-hidden
              >
                <Brain size={22} strokeWidth={2} />
              </span>
              <div>
                <h2 className="text-ink font-display text-lg font-bold tracking-tight">Content performance</h2>
                <p className="text-muted mt-1 max-w-2xl text-sm leading-relaxed">
                  AI reads your recent posts and returns key takeaways, concrete actions, and any risk notes.
                </p>
              </div>
            </div>
            {insight ? (
              <span className="text-muted rounded-full border border-subtle bg-surface px-3 py-1 text-xs font-semibold tabular-nums">
                Updated {new Date(insight.generatedAt).toLocaleString()}
              </span>
            ) : null}
          </div>

          {!insight && !generating ? (
            <div className="rounded-xl border border-dashed border-subtle bg-surface/40 px-4 py-8 text-center sm:px-8">
              <div
                className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-subtle"
                style={{
                  background: "linear-gradient(145deg, rgba(108,99,255,0.18), rgba(0,212,170,0.12))"
                }}
                aria-hidden
              >
                <Brain className="text-accent-purple" size={36} strokeWidth={1.5} />
              </div>
              <p className="text-ink m-0 text-sm font-medium">No AI insight yet</p>
              <p className="text-muted mx-auto mt-2 max-w-md text-sm leading-relaxed">
                We read your recent posts and turn them into simple tips. Connect Instagram and sync posts if you have not yet.
              </p>
              <button
                type="button"
                onClick={generateInsightFlow}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent-purple to-accent-teal px-5 py-3 text-sm font-bold text-ink shadow-glow transition-transform duration-200 hover:scale-[1.02] hover:shadow-teal active:scale-[0.98]"
              >
                <Sparkles size={18} strokeWidth={2.5} aria-hidden />
                Generate your first insight
              </button>
            </div>
          ) : null}

          {generating ? (
            <div className="text-muted mt-4 flex items-center gap-3">
              <Loader2 className="text-accent-teal h-7 w-7 shrink-0 animate-spin" aria-hidden />
              <span className="text-sm">Analysing your posts…</span>
            </div>
          ) : null}

          {insight ? (
            <>
              {insight.summary?.trim() ? (
                <div className="border-accent-teal/20 bg-surface/60 mt-6 rounded-xl border p-5">
                  <h3 className="text-accent-teal mb-3 text-xs font-bold uppercase tracking-wide">Summary</h3>
                  <p className="text-ink m-0 text-sm leading-relaxed whitespace-pre-wrap">{insight.summary.trim()}</p>
                </div>
              ) : null}
              <div className="mt-8 grid gap-4 lg:grid-cols-3">
                <div className="rounded-xl border border-subtle bg-surface/80 p-5 transition-all duration-200 hover:border-accent-purple/30 hover:shadow-glow">
                  <h3 className="text-accent-purple mb-4 text-xs font-bold uppercase tracking-wide">Key insights</h3>
                  <InsightList items={insight.keyInsights} />
                </div>
                <div className="rounded-xl border border-subtle bg-surface/80 p-5 transition-all duration-200 hover:border-accent-teal/30 hover:shadow-glow">
                  <h3 className="text-accent-teal mb-4 text-xs font-bold uppercase tracking-wide">Actions this week</h3>
                  <InsightList items={insight.actionsThisWeek} />
                </div>
                <div
                  className={`rounded-xl border p-5 transition-all duration-200 hover:shadow-glow ${
                    insight.warning
                      ? "border-warning/40 bg-warning/10"
                      : "border-subtle bg-surface/80 hover:border-subtle"
                  }`}
                >
                  <h3 className="text-warning mb-4 text-xs font-bold uppercase tracking-wide">Warning</h3>
                  <p className="text-ink text-sm leading-relaxed">{insight.warning ?? "No warnings noted."}</p>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="button secondary"
                  disabled={cooldownRemainingSeconds > 0 || generating}
                  onClick={generateInsightFlow}
                >
                  {cooldownRemainingSeconds > 0
                    ? `Regenerate (${cooldownRemainingSeconds}s)`
                    : "Regenerate"}
                </button>
                <span className="text-muted hidden h-6 w-px bg-[#1E1E2E] sm:block" aria-hidden />
                <button
                  type="button"
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
                    insight.userFeedback === 1
                      ? "border-accent-teal/50 bg-accent-teal/15 text-accent-teal"
                      : "border-subtle bg-surface text-muted hover:border-accent-teal/35 hover:text-accent-teal"
                  }`}
                  onClick={() => postFeedback("up")}
                  disabled={insight.userFeedback === 1}
                  aria-label="Thumbs up"
                >
                  <ThumbsUp size={18} strokeWidth={2} />
                </button>
                <button
                  type="button"
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
                    insight.userFeedback === -1
                      ? "border-danger/50 bg-danger/15 text-danger"
                      : "border-subtle bg-surface text-muted hover:border-danger/35 hover:text-danger"
                  }`}
                  onClick={() => postFeedback("down")}
                  disabled={insight.userFeedback === -1}
                  aria-label="Thumbs down"
                >
                  <ThumbsDown size={18} strokeWidth={2} />
                </button>
              </div>
            </>
          ) : null}
        </div>

        <div className="gradient-border p-6 sm:p-8">
          <div className="mb-6 flex items-start gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-accent-teal/35 bg-gradient-to-br from-accent-teal/20 to-accent-purple/10 text-accent-teal"
              aria-hidden
            >
              <Target size={22} strokeWidth={2} />
            </span>
            <div>
              <h2 className="text-ink font-display text-lg font-bold tracking-tight">This week&apos;s focus</h2>
              <p className="text-muted mt-1 max-w-2xl text-sm leading-relaxed">
                One plain-language priority you can act on. Demo mode may use a grounded fallback when no AI key is set.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="button secondary"
            onClick={generateWeeklyFocus}
            disabled={weeklyLoading}
          >
            {weeklyLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Generating…
              </span>
            ) : (
              "Get weekly focus"
            )}
          </button>
          {weeklyFocus ? (
            <p className="text-ink mt-6 rounded-xl border border-subtle bg-surface/60 p-4 text-sm leading-relaxed">
              {weeklyFocus}
            </p>
          ) : (
            <p className="text-muted mt-4 text-sm">Not generated yet — run after you have content performance context.</p>
          )}
        </div>

        <div className="gradient-border p-6 sm:p-8">
          <div className="mb-6 flex items-start gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-accent-purple/35 bg-gradient-to-br from-accent-purple/20 to-accent-teal/15 text-accent-purple"
              aria-hidden
            >
              <Wand2 size={22} strokeWidth={2} />
            </span>
            <div>
              <h2 className="text-ink font-display text-lg font-bold tracking-tight">Caption generator</h2>
              <p className="text-muted mt-1 max-w-2xl text-sm leading-relaxed">
                Pick a tone and goal; optional offer tightens the copy. Copy any card to your clipboard.
              </p>
            </div>
          </div>

          <div className="flex max-w-xl flex-col gap-4">
            <div>
              <label className="text-muted mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor="insight-tone">
                Tone
              </label>
              <select id="insight-tone" className="input" value={tone} onChange={(e) => setTone(e.target.value)}>
                {TONES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-muted mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor="insight-goal">
                Goal
              </label>
              <input
                id="insight-goal"
                className="input"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="What should this caption achieve?"
              />
            </div>
            <div>
              <label className="text-muted mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor="insight-offer">
                Offer <span className="font-normal opacity-70">(optional)</span>
              </label>
              <input
                id="insight-offer"
                className="input"
                value={offer}
                onChange={(e) => setOffer(e.target.value)}
                placeholder="e.g. 10% off this week"
              />
            </div>
            <button
              type="button"
              onClick={generateCaptions}
              disabled={captionLoading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-purple to-accent-teal px-5 py-3 text-sm font-bold text-ink shadow-glow transition-transform duration-200 hover:scale-[1.01] hover:shadow-teal active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
            >
              {captionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles size={18} strokeWidth={2.5} aria-hidden />
                  Generate captions
                </>
              )}
            </button>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {captionLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-subtle bg-surface/30 p-5"
                    aria-hidden
                  >
                    <div className="skeleton skeleton-line mb-3 w-1/4" />
                    <div className="skeleton skeleton-line mb-2 w-full" />
                    <div className="skeleton mb-4 h-16 w-full rounded-lg" />
                    <div className="skeleton h-8 w-24 rounded-lg" />
                  </div>
                ))
              : captions.map((c, idx) => (
                  <article
                    key={`${idx}-${c.hook.slice(0, 8)}`}
                    className="flex flex-col rounded-xl border border-subtle bg-surface/80 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-purple/25 hover:shadow-glow"
                  >
                    <div className="space-y-3 text-sm">
                      <div>
                        <div className="text-accent-purple mb-1 text-[0.65rem] font-bold uppercase tracking-wide">
                          Hook
                        </div>
                        <p className="text-ink leading-relaxed">{c.hook}</p>
                      </div>
                      <div>
                        <div className="text-muted mb-1 text-[0.65rem] font-bold uppercase tracking-wide">Body</div>
                        <p className="text-ink leading-relaxed">{c.body}</p>
                      </div>
                      <div>
                        <div className="text-accent-teal mb-1 text-[0.65rem] font-bold uppercase tracking-wide">CTA</div>
                        <p className="text-ink leading-relaxed">{c.cta}</p>
                      </div>
                      <div>
                        <div className="text-muted mb-1 text-[0.65rem] font-bold uppercase tracking-wide">Hashtags</div>
                        <p className="text-muted font-mono text-xs leading-relaxed">{c.hashtags.join(" ")}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="button secondary mt-5 inline-flex w-full items-center justify-center gap-2 text-xs sm:w-auto"
                      onClick={() =>
                        copyText([c.hook, c.body, c.cta, c.hashtags.join(" ")].join("\n\n"))
                      }
                    >
                      <Copy size={14} strokeWidth={2} aria-hidden />
                      Copy all
                    </button>
                  </article>
                ))}
          </div>

          {billing && (
            <div className="mt-8 space-y-2 rounded-xl border border-white/8 bg-white/5 px-4 py-4">
              <div className="flex justify-between text-xs text-white/50">
                <span>AI generations this month</span>
                <span
                  className={
                    upgradeUsagePct >= 90 ? "text-red-400" : upgradeUsagePct >= 70 ? "text-amber-400" : "text-teal-400"
                  }
                >
                  {billing.generationsUsed} / {billing.generationsLimit}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all ${
                    upgradeUsagePct >= 90 ? "bg-red-500" : upgradeUsagePct >= 70 ? "bg-amber-500" : "bg-teal-500"
                  }`}
                  style={{ width: `${Math.min(upgradeUsagePct, 100)}%` }}
                />
              </div>
              {upgradeUsagePct >= 80 && (
                <button
                  type="button"
                  onClick={() => setShowUpgrade(true)}
                  className="text-xs font-medium text-accent-purple transition-colors hover:text-accent-purple/80"
                >
                  Upgrade for more →
                </button>
              )}
            </div>
          )}
        </div>
      </section>
      {rewardMessage ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-accent-teal/30 bg-[#111118] px-5 py-3 text-sm font-medium text-accent-teal shadow-lg">
          {rewardMessage}
        </div>
      ) : null}
      <UpgradeModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        usagePct={upgradeUsagePct}
        estimatedMissedMonthlyRevenue={missedMonthlyRevenue}
        feature="ai_generations"
        featureName="AI generations"
      />
    </div>
  );
}
