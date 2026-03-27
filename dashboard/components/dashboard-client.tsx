"use client";

import { useMemo, useState, useTransition } from "react";
import { api, type AnalyticsSummary } from "../lib/api";

type InsightResponse = {
  title: string;
  summary: string;
  payload: unknown;
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

export function DashboardClient() {
  const [token, setToken] = useState("");
  const [clientId, setClientId] = useState("");
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [insight, setInsight] = useState<InsightResponse | null>(null);
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(null);
  const [captions, setCaptions] = useState<string[]>([]);
  const [instagramAuthUrl, setInstagramAuthUrl] = useState("");
  const [error, setError] = useState("");
  const [captionForm, setCaptionForm] = useState(demoBusiness);
  const [isPending, startTransition] = useTransition();

  const bestHourLabel = useMemo(() => {
    if (!summary?.topHours?.length) return "No data yet";
    return `${summary.topHours[0].hour}:00`;
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
      <section className="hero">
        <div className="hero-card">
          <div className="eyebrow">Instagram Growth Copilot</div>
          <h1>Turn your backend into a real SaaS dashboard for local businesses.</h1>
          <p>
            This frontend talks directly to your new analytics and AI endpoints. Use it to connect
            Instagram, inspect performance, generate weekly recommendations, and create captions for
            local businesses from one place.
          </p>
          <div className="badge-row">
            <span className="badge">Instagram-first MVP</span>
            <span className="badge">AI insights</span>
            <span className="badge">Caption generation</span>
            <span className="badge">Weekly recommendations</span>
          </div>
        </div>

        <div className="hero-card auth-panel">
          <h2>Connect Dashboard</h2>
          <div className="form-grid">
            <div>
              <div className="muted">JWT bearer token</div>
              <textarea
                className="textarea"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="Paste a valid access token from your backend"
              />
            </div>
            <div>
              <div className="muted">Client ID</div>
              <input
                className="input"
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
                placeholder="cl_..."
              />
            </div>
            <div className="actions">
              <button className="button" onClick={loadSummary} disabled={isPending}>
                Load Analytics
              </button>
              <button className="button secondary" onClick={buildInstagramAuth} disabled={isPending}>
                Build Instagram Connect URL
              </button>
            </div>
            {instagramAuthUrl ? (
              <a className="success" href={instagramAuthUrl} target="_blank" rel="noreferrer">
                Open Instagram OAuth flow
              </a>
            ) : null}
            {error ? <div style={{ color: "#b42318" }}>{error}</div> : null}
          </div>
        </div>
      </section>

      <section className="section-grid">
        <div className="panel span-12">
          <h2>Performance Snapshot</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Posts analyzed</div>
              <div className="stat-value">{summary?.postsAnalyzed ?? 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Average engagement rate</div>
              <div className="stat-value">{summary?.averageEngagementRate?.toFixed(2) ?? "0.00"}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Best posting hour</div>
              <div className="stat-value">{bestHourLabel}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Caption winner</div>
              <div className="stat-value">
                {summary?.captionPerformance?.length
                  ? [...summary.captionPerformance].sort(
                      (a, b) => b.avgEngagementRate - a.avgEngagementRate
                    )[0]?.bucket
                  : "N/A"}
              </div>
            </div>
          </div>
        </div>

        <div className="panel span-8">
          <h3>Top-performing hours</h3>
          <ol className="list">
            {summary?.topHours?.map((item) => (
              <li key={item.hour}>
                {item.hour}:00 with average engagement rate {item.avgEngagementRate.toFixed(2)}
              </li>
            )) ?? <li>No analytics loaded yet.</li>}
          </ol>
        </div>

        <div className="panel span-4">
          <h3>Caption length performance</h3>
          <ol className="list">
            {summary?.captionPerformance?.map((item) => (
              <li key={item.bucket}>
                {item.bucket}: {item.avgEngagementRate.toFixed(2)}
              </li>
            )) ?? <li>No caption data yet.</li>}
          </ol>
        </div>

        <div className="panel span-6">
          <h3>Best posts</h3>
          <ol className="list">
            {summary?.topPosts?.map((post) => (
              <li key={post.id}>
                {(post.caption || "Untitled post").slice(0, 90)} | {post.engagementRate.toFixed(2)}
              </li>
            )) ?? <li>No top posts available.</li>}
          </ol>
        </div>

        <div className="panel span-6">
          <h3>Worst posts</h3>
          <ol className="list">
            {summary?.worstPosts?.map((post) => (
              <li key={post.id}>
                {(post.caption || "Untitled post").slice(0, 90)} | {post.engagementRate.toFixed(2)}
              </li>
            )) ?? <li>No low-performing posts available.</li>}
          </ol>
        </div>

        <div className="panel span-6">
          <h3>AI Content Performance Insight</h3>
          <p className="muted">
            Generates a narrative summary from the analytics summary and stores it in the backend.
          </p>
          <div className="actions">
            <button className="button" onClick={generateInsight} disabled={isPending}>
              Generate Insight
            </button>
          </div>
          {insight ? <p>{insight.summary}</p> : <p className="muted">No insight generated yet.</p>}
        </div>

        <div className="panel span-6">
          <h3>Weekly Growth Recommendation</h3>
          <p className="muted">Turns rule signals into one actionable weekly recommendation.</p>
          <div className="actions">
            <button className="button" onClick={generateRecommendation} disabled={isPending}>
              Generate Recommendation
            </button>
          </div>
          {recommendation ? (
            <p>{recommendation.text}</p>
          ) : (
            <p className="muted">No recommendation generated yet.</p>
          )}
        </div>

        <div className="panel span-12">
          <h3>Caption Generator</h3>
          <div className="two-col">
            <div className="form-grid">
              <input
                className="input"
                value={captionForm.niche}
                onChange={(event) => setCaptionForm((prev) => ({ ...prev, niche: event.target.value }))}
                placeholder="niche"
              />
              <input
                className="input"
                value={captionForm.tone}
                onChange={(event) => setCaptionForm((prev) => ({ ...prev, tone: event.target.value }))}
                placeholder="tone"
              />
              <input
                className="input"
                value={captionForm.objective}
                onChange={(event) => setCaptionForm((prev) => ({ ...prev, objective: event.target.value }))}
                placeholder="objective"
              />
              <input
                className="input"
                value={captionForm.offer}
                onChange={(event) => setCaptionForm((prev) => ({ ...prev, offer: event.target.value }))}
                placeholder="offer"
              />
              <div className="actions">
                <button className="button" onClick={generateCaptions} disabled={isPending}>
                  Generate Captions
                </button>
              </div>
            </div>

            <div className="form-grid">
              {captions.length ? (
                captions.map((caption, index) => (
                  <div className="caption-card" key={`${index}-${caption.slice(0, 12)}`}>
                    {caption}
                  </div>
                ))
              ) : (
                <div className="caption-card muted">
                  Generated captions will appear here after you connect the dashboard to a client.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
