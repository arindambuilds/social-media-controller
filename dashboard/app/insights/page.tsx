"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, fetchMe, type CaptionCard } from "../../lib/api";
import { CLIENT_ID_KEY, getStoredClientId, getStoredToken } from "../../lib/auth-storage";

type InsightPayload = {
  id: string;
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

  const refreshLatest = useCallback(async (cid: string) => {
    const res = await apiFetch(`/insights/${encodeURIComponent(cid)}/content-performance/latest`);
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as LatestResponse;
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
        if (!cid) {
          const me = await fetchMe(token);
          cid = me.user.clientId;
          if (cid) localStorage.setItem(CLIENT_ID_KEY, cid);
        }
        if (!cid) {
          setError("No client ID for this account.");
          setLoadingLatest(false);
          return;
        }
        setClientId(cid);
        await refreshLatest(cid);
        const bill = await apiFetch(`/billing/${encodeURIComponent(cid)}/status`);
        if (bill.ok) {
          const b = (await bill.json()) as { generationsUsed: number; generationsLimit: number };
          setBilling(b);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoadingLatest(false);
      }
    })();
  }, [router, refreshLatest]);

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
      const res = await apiFetch(`/insights/${encodeURIComponent(clientId)}/content-performance/generate`, {
        method: "POST",
        body: JSON.stringify({})
      });
      if (res.status === 429) {
        const body = (await res.json()) as { cooldownRemainingSeconds?: number };
        setCooldownRemainingSeconds(body.cooldownRemainingSeconds ?? 0);
        return;
      }
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      let data = (await res.json()) as LatestResponse;
      if (!data.insight) {
        for (let i = 0; i < 10; i++) {
          await new Promise((r) => setTimeout(r, 4000));
          const poll = await apiFetch(`/insights/${encodeURIComponent(clientId)}/content-performance/latest`);
          if (!poll.ok) continue;
          data = (await poll.json()) as LatestResponse;
          if (data.insight) break;
        }
        if (!data.insight) {
          setError("Taking longer than expected — check back in a minute.");
          return;
        }
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
    const res = await apiFetch(`/insights/${encodeURIComponent(clientId)}/${encodeURIComponent(insight.id)}/feedback`, {
      method: "POST",
      body: JSON.stringify({ vote })
    });
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    setInsight((prev) =>
      prev ? { ...prev, userFeedback: vote === "up" ? 1 : -1 } : prev
    );
  }

  async function generateCaptions() {
    if (!clientId) return;
    setCaptionLoading(true);
    setCaptions([]);
    setError("");
    try {
      const res = await apiFetch(`/ai/${encodeURIComponent(clientId)}/captions/generate`, {
        method: "POST",
        body: JSON.stringify({ tone, goal, offer: offer || undefined })
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const data = (await res.json()) as { captions: CaptionCard[] };
      setCaptions(Array.isArray(data.captions) ? data.captions : []);
      const bill = await apiFetch(`/billing/${encodeURIComponent(clientId)}/status`);
      if (bill.ok) {
        const b = (await bill.json()) as { generationsUsed: number; generationsLimit: number };
        setBilling(b);
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
        <section className="panel span-12">
          <h2>Insights</h2>
          <div className="skeleton" style={{ height: 120 }} />
        </section>
      </div>
    );
  }

  if (error && !clientId) {
    return (
      <div className="page-shell">
        <section className="panel span-12">
          <p className="text-error">{error}</p>
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <section className="panel span-12">
        <h2>Insights</h2>
        {error ? <p className="text-error">{error}</p> : null}
      </section>

      <section className="section-grid">
        <div className="panel span-12">
          <h3>Content performance insight</h3>
          {!insight && !generating ? (
            <div className="actions">
              <button type="button" className="button" onClick={generateInsightFlow}>
                Generate your first insight
              </button>
            </div>
          ) : null}

          {generating ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
              <div className="spinner" style={{ width: 28, height: 28 }} />
              <span className="muted">Analysing your posts...</span>
            </div>
          ) : null}

          {insight ? (
            <>
              <div className="section-grid" style={{ marginTop: 16 }}>
                <div className="caption-card span-4">
                  <h4>Key insights</h4>
                  <ul className="list">
                    {insight.keyInsights.map((k) => (
                      <li key={k.slice(0, 40)}>{k}</li>
                    ))}
                  </ul>
                </div>
                <div className="caption-card span-4">
                  <h4>Actions this week</h4>
                  <ul className="list">
                    {insight.actionsThisWeek.map((k) => (
                      <li key={k.slice(0, 40)}>{k}</li>
                    ))}
                  </ul>
                </div>
                <div className="caption-card span-4">
                  <h4>Warning</h4>
                  <p>{insight.warning ?? "No warnings noted."}</p>
                </div>
              </div>
              <div className="actions" style={{ marginTop: 16 }}>
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
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => postFeedback("up")}
                  disabled={insight.userFeedback === 1}
                  aria-label="Thumbs up"
                >
                  👍
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => postFeedback("down")}
                  disabled={insight.userFeedback === -1}
                  aria-label="Thumbs down"
                >
                  👎
                </button>
              </div>
            </>
          ) : null}
        </div>

        <div className="panel span-12">
          <h3>Caption generator</h3>
          <div className="form-grid" style={{ maxWidth: 520 }}>
            <label className="muted">
              Tone
              <select className="input" value={tone} onChange={(e) => setTone(e.target.value)}>
                {TONES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <input className="input" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Goal" />
            <input
              className="input"
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              placeholder="Offer (optional)"
            />
            <button type="button" className="button" onClick={generateCaptions} disabled={captionLoading}>
              Generate captions
            </button>
          </div>

          <div className="section-grid" style={{ marginTop: 20 }}>
            {captionLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="caption-card span-6 pulse-skeleton">
                    <div className="skeleton" style={{ height: 14, marginBottom: 8 }} />
                    <div className="skeleton" style={{ height: 48, marginBottom: 8 }} />
                    <div className="skeleton" style={{ height: 14, width: "40%" }} />
                  </div>
                ))
              : captions.map((c, idx) => (
                  <div className="caption-card span-6" key={`${idx}-${c.hook.slice(0, 8)}`}>
                    <div className="muted">Hook</div>
                    <p>{c.hook}</p>
                    <div className="muted">Body</div>
                    <p>{c.body}</p>
                    <div className="muted">CTA</div>
                    <p>{c.cta}</p>
                    <div className="muted">Hashtags</div>
                    <p>{c.hashtags.join(" ")}</p>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() =>
                        copyText([c.hook, c.body, c.cta, c.hashtags.join(" ")].join("\n\n"))
                      }
                    >
                      Copy
                    </button>
                  </div>
                ))}
          </div>

          {billing ? (
            <p className="muted" style={{ marginTop: 24 }}>
              {billing.generationsUsed} / {billing.generationsLimit} AI generations used this month
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
