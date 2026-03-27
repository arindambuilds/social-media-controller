"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { api, type AnalyticsSummary, type CaptionCard } from "../lib/api";
import { InsightPulse } from "./ui/insight-pulse";
import { MetricStat } from "./ui/metric-stat";
import { NextStepCard } from "./ui/next-step-card";
import { PageHeader } from "./ui/page-header";
import { ProgressBar } from "./ui/progress-bar";
import { UpgradeNudge } from "./ui/upgrade-nudge";

type InsightResponse = {
  summary?: string;
  title?: string;
  payload?: unknown;
};

type RecommendationResponse = {
  text: string;
};

const demoBusiness = {
  niche: "salon",
  tone: "warm and expert",
  objective: "book more bridal and grooming appointments",
  offer: "Weekend makeover package"
};

function formatHour(h: number | undefined): string {
  if (h === undefined) return "your peak window";
  const suffix = h >= 12 ? "PM" : "AM";
  const n = h % 12 === 0 ? 12 : h % 12;
  return `${n}:00 ${suffix}`;
}

export function DashboardClient() {
  const [token, setToken] = useState("");
  const [clientId, setClientId] = useState("");
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [insight, setInsight] = useState<InsightResponse | null>(null);
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(null);
  const [captions, setCaptions] = useState<(string | CaptionCard)[]>([]);
  const [instagramAuthUrl, setInstagramAuthUrl] = useState("");
  const [error, setError] = useState("");
  const [captionForm, setCaptionForm] = useState(demoBusiness);
  const [isPending, startTransition] = useTransition();

  const bestHourLabel = useMemo(() => {
    if (!summary?.topHours?.length) return "—";
    return formatHour(summary.topHours[0]);
  }, [summary]);

  const profileStrength = useMemo(() => {
    const n = summary?.postsAnalyzed ?? 0;
    return Math.min(100, Math.round(n * 4.5 + (summary ? 15 : 0)));
  }, [summary]);

  const pulseCopy = useMemo(() => {
    if (!summary?.postsAnalyzed) {
      return {
        title: "Your Instagram cockpit is ready",
        body: "Connect Instagram (or use seeded demo data), then load analytics for posting windows, AI insights, and captions tuned to a local business like yours."
      };
    }
    const h = summary.topHours?.[0];
    return {
      title: "Smart signal detected",
      body: `You have ${summary.postsAnalyzed} posts in your sample. Double down around ${formatHour(h)} — that window is outperforming the rest of your schedule right now.`
    };
  }, [summary]);

  const engagementTrend = useMemo(() => {
    if (!summary?.postsAnalyzed) {
      return { direction: "neutral" as const, text: "Load data to see momentum" };
    }
    const avgIx = summary.averageEngagementRate ?? 0;
    if (avgIx > 120) return { direction: "up" as const, text: "Strong interaction depth (sample)" };
    if (avgIx > 50) return { direction: "up" as const, text: "Healthy baseline — keep iterating" };
    return { direction: "neutral" as const, text: "Room to optimize hooks & CTAs" };
  }, [summary]);

  const loadSummary = () => {
    setError("");
    startTransition(async () => {
      try {
        const data = await api.analyticsSummary(clientId, token);
        setSummary(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load analytics");
      }
    });
  };

  const generateInsight = () => {
    setError("");
    startTransition(async () => {
      try {
        const data = (await api.generateInsight(clientId, token)) as InsightResponse;
        setInsight(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate insight");
      }
    });
  };

  const generateRecommendation = () => {
    setError("");
    startTransition(async () => {
      try {
        const data = (await api.generateWeeklyRecommendation(clientId, token)) as RecommendationResponse;
        setRecommendation(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate recommendation");
      }
    });
  };

  const generateCaptions = () => {
    setError("");
    startTransition(async () => {
      try {
        const data = await api.generateCaptions(token, { clientId, ...captionForm });
        setCaptions(data.captions);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate captions");
      }
    });
  };

  const buildInstagramAuth = () => {
    setError("");
    startTransition(async () => {
      try {
        const data = await api.startInstagramAuth(clientId, token);
        setInstagramAuthUrl(data.authUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to build Instagram auth URL");
      }
    });
  };

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Instagram growth copilot"
        title="Grow locally — with clarity, not chaos"
        description="See what works on Instagram, get plain-language next steps, and draft captions — built for salons, cafés, gyms, and neighbourhood brands in India (pilot-ready for Odisha)."
        actions={
          <>
            <Link href="/analytics" className="button">
              Analyze content
            </Link>
            <Link href="/insights" className="button secondary">
              Boost with AI
            </Link>
          </>
        }
      />

      <InsightPulse title={pulseCopy.title} body={pulseCopy.body} />

      <UpgradeNudge />

      <div className="dash-metrics">
        <MetricStat
          label="Posts in view"
          value={summary ? String(summary.postsAnalyzed) : "—"}
          hint={summary ? "Synced performance sample" : "Load analytics to populate"}
          trend={engagementTrend}
        />
        <MetricStat
          label="Avg interactions / post"
          value={summary ? summary.averageEngagementRate.toFixed(1) : "—"}
          hint="Likes + comments + shares (sample), not a percentage"
          accent={!!summary && (summary.averageEngagementRate ?? 0) > 50}
        />
        <MetricStat label="Power hour" value={summary ? bestHourLabel : "—"} hint="When your audience leans in" />
        <MetricStat
          label="Top format signal"
          value={summary?.captionWinner ? summary.captionWinner.slice(0, 18) + "…" : "—"}
          hint="From your latest winners"
        />
      </div>

      <ProgressBar value={profileStrength} label="Profile strength — keep feeding the algorithm fresh posts" />

      <div className="dash-next-grid">
        <NextStepCard
          href="/analytics"
          title="Deep-dive analytics"
          description="Charts, top posts, and hourly performance so you know exactly what to double down on."
          cta="Open analytics →"
          icon="📊"
        />
        <NextStepCard
          href="/insights"
          title="AI growth partner"
          description="Weekly-style insights and caption packs tuned to your tone and goals."
          cta="Generate insights →"
          icon="✨"
        />
        <NextStepCard
          href="/onboarding"
          title="Connect Instagram"
          description="One flow to authorize Meta and sync posts — takes under a minute."
          cta="Start connect →"
          icon="🔗"
        />
      </div>

      <section className="hero">
        <div className="hero-card">
          <div className="eyebrow">Playbooks</div>
          <h1 style={{ marginBottom: 12 }}>Ship content that converts</h1>
          <p>
            Stack hooks, proof, and a single CTA. Reuse your top-performing structure from the analytics tab,
            then let AI draft variations so you stay consistent without burning out.
          </p>
          <div className="badge-row">
            <span className="badge">Instagram-first</span>
            <span className="badge">AI co-pilot</span>
            <span className="badge">Caption lab</span>
            <span className="badge">Weekly focus</span>
          </div>
        </div>

        <details className="dash-details">
          <summary>Developer access — token &amp; client ID</summary>
          <div className="dash-details-body">
            <p className="muted" style={{ marginTop: 0 }}>
              For API testing or demos. Prefer signing in at{" "}
              <Link href="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>
                Login
              </Link>{" "}
              for the full experience.
            </p>
            <div className="form-grid">
              <div>
                <div className="muted">JWT bearer token</div>
                <textarea
                  className="textarea"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="Paste access token"
                />
              </div>
              <div>
                <div className="muted">Client ID</div>
                <input
                  className="input"
                  value={clientId}
                  onChange={(event) => setClientId(event.target.value)}
                  placeholder="Client id"
                />
              </div>
              <div className="actions">
                <button className="button" type="button" onClick={loadSummary} disabled={isPending}>
                  Load analytics
                </button>
                <button className="button secondary" type="button" onClick={buildInstagramAuth} disabled={isPending}>
                  Build connect URL
                </button>
              </div>
              {instagramAuthUrl ? (
                <a className="success" href={instagramAuthUrl} target="_blank" rel="noreferrer">
                  Open Instagram OAuth flow
                </a>
              ) : null}
              {error ? <div className="text-error">{error}</div> : null}
            </div>
          </div>
        </details>
      </section>

      <section className="section-grid">
        <div className="panel span-12">
          <h2>Performance snapshot</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Posts analyzed</div>
              <div className="stat-value">{summary?.postsAnalyzed ?? 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg interactions / post</div>
              <div className="stat-value">{summary?.averageEngagementRate?.toFixed(1) ?? "0.0"}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Best posting hour</div>
              <div className="stat-value">{bestHourLabel}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Caption winner</div>
              <div className="stat-value">
                {summary?.captionWinner ? summary.captionWinner.slice(0, 24) : "N/A"}
              </div>
            </div>
          </div>
        </div>

        <div className="panel span-8">
          <h3>Top-performing hours</h3>
          <ol className="list">
            {summary?.topHours?.map((hour: number) => (
              <li key={hour}>{formatHour(hour)}</li>
            )) ?? <li>No analytics loaded yet.</li>}
          </ol>
        </div>

        <div className="panel span-4">
          <h3>Caption length performance</h3>
          <ol className="list">
            <li>Avg likes: {summary?.captionPerformance?.avgLikes?.toFixed(1) ?? "0.0"}</li>
            <li>Avg comments: {summary?.captionPerformance?.avgComments?.toFixed(1) ?? "0.0"}</li>
            <li>Avg shares: {summary?.captionPerformance?.avgShares?.toFixed(1) ?? "0.0"}</li>
          </ol>
        </div>

        <div className="panel span-6">
          <h3>Best posts</h3>
          <ol className="list">
            {summary?.topPosts?.map((post: { id: string; content?: string | null; platformPostId: string }) => (
              <li key={post.id}>{(post.content || post.platformPostId || "Untitled post").slice(0, 90)}</li>
            )) ?? <li>No top posts available.</li>}
          </ol>
        </div>

        <div className="panel span-6">
          <h3>Posts to refresh</h3>
          <ol className="list">
            {summary?.worstPosts?.map((post: { id: string; content?: string | null; platformPostId: string }) => (
              <li key={post.id}>{(post.content || post.platformPostId || "Untitled post").slice(0, 90)}</li>
            )) ?? <li>No low-performing posts available.</li>}
          </ol>
        </div>

        <div className="panel span-6">
          <h3>AI content performance</h3>
          <p className="muted">Narrative summary from your latest analytics sample.</p>
          <div className="actions">
            <button className="button" type="button" onClick={generateInsight} disabled={isPending}>
              Generate insight
            </button>
          </div>
          {insight?.summary ? (
            <p>{insight.summary}</p>
          ) : (
            <p className="muted">No insight generated yet.</p>
          )}
        </div>

        <div className="panel span-6">
          <h3>This week&apos;s focus</h3>
          <p className="muted">One prioritized action so you are never guessing what to ship next.</p>
          <div className="actions">
            <button className="button secondary" type="button" onClick={generateRecommendation} disabled={isPending}>
              Get recommendation
            </button>
          </div>
          {recommendation ? (
            <p>{recommendation.text}</p>
          ) : (
            <p className="muted">No recommendation generated yet.</p>
          )}
        </div>

        <div className="panel span-12">
          <h3>Caption lab</h3>
          <div className="two-col">
            <div className="form-grid">
              <input
                className="input"
                value={captionForm.niche}
                onChange={(event) => setCaptionForm((prev) => ({ ...prev, niche: event.target.value }))}
                placeholder="Niche"
              />
              <input
                className="input"
                value={captionForm.tone}
                onChange={(event) => setCaptionForm((prev) => ({ ...prev, tone: event.target.value }))}
                placeholder="Tone"
              />
              <input
                className="input"
                value={captionForm.objective}
                onChange={(event) => setCaptionForm((prev) => ({ ...prev, objective: event.target.value }))}
                placeholder="Objective"
              />
              <input
                className="input"
                value={captionForm.offer}
                onChange={(event) => setCaptionForm((prev) => ({ ...prev, offer: event.target.value }))}
                placeholder="Offer"
              />
              <div className="actions">
                <button className="button" type="button" onClick={generateCaptions} disabled={isPending}>
                  Generate captions
                </button>
              </div>
            </div>

            <div className="form-grid">
              {captions.length ? (
                captions.map((caption, index) => (
                  <div
                    className="caption-card"
                    key={`${index}-${typeof caption === "string" ? caption.slice(0, 12) : caption.hook.slice(0, 12)}`}
                  >
                    {typeof caption === "string"
                      ? caption
                      : [caption.hook, caption.body, caption.cta, caption.hashtags.join(" ")].join("\n\n")}
                  </div>
                ))
              ) : (
                <div className="caption-card muted">Generated captions will appear here.</div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
