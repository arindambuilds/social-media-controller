"use client";

import { RefreshCw, SunMedium } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

type BriefingRow = {
  id: string;
  content: string;
  sentAt: string;
  createdAt: string;
  tipText?: string | null;
};

type LatestResponse = {
  briefing: BriefingRow | null;
};

function todayLabelIst(): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date());
}

export function MorningBriefingCard({ clientId }: { clientId: string | null }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [briefing, setBriefing] = useState<BriefingRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = clientId ? `?clientId=${encodeURIComponent(clientId)}` : "";

  const load = useCallback(async () => {
    if (!clientId) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const data = await apiFetch<LatestResponse>(`/briefing/latest${query}`);
      setBriefing(data.briefing ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load briefing");
      setBriefing(null);
    } finally {
      setLoading(false);
    }
  }, [clientId, query]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  async function onRefresh() {
    if (!clientId) return;
    setRefreshing(true);
    setError(null);
    try {
      await apiFetch<{ success?: boolean; briefing?: string }>(`/briefing/trigger`, {
        method: "POST",
        body: JSON.stringify({ clientId }),
        timeoutMs: 90_000
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  if (!clientId) {
    return null;
  }

  return (
    <section
      className="mt-6 rounded-xl border border-subtle border-l-4 border-l-warning bg-surface/80 p-5 md:p-6"
      aria-labelledby="morning-briefing-heading"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-warning/40 bg-warning/10 text-warning"
            aria-hidden
          >
            <SunMedium size={20} strokeWidth={2} />
          </span>
          <div>
            <h2 id="morning-briefing-heading" className="text-ink font-display text-lg font-bold tracking-tight">
              Today&apos;s briefing
            </h2>
            <p className="text-muted mt-0.5 text-sm">{todayLabelIst()}</p>
          </div>
        </div>
        <button
          type="button"
          className="button secondary inline-flex items-center gap-2 text-xs"
          onClick={() => void onRefresh()}
          disabled={refreshing}
        >
          <RefreshCw className={refreshing ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} aria-hidden />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          <div className="skeleton h-4 w-full rounded-lg" />
          <div className="skeleton h-4 w-[92%] rounded-lg" />
          <div className="skeleton h-4 w-[88%] rounded-lg" />
        </div>
      ) : error ? (
        <p className="text-error m-0 text-sm">{error}</p>
      ) : briefing ? (
        <div className="space-y-3">
          <p className="text-ink m-0 text-base leading-relaxed tracking-tight md:text-[1.05rem]">{briefing.content}</p>
          <Link
            href={`/briefing/${briefing.id}`}
            className="text-accent-teal inline-block text-sm font-semibold underline-offset-2 hover:underline"
          >
            Open full briefing
          </Link>
        </div>
      ) : (
        <p className="text-muted m-0 text-sm leading-relaxed">
          Your 8 AM briefing will appear here once the first run completes. Use Refresh to generate one now.
        </p>
      )}
    </section>
  );
}
