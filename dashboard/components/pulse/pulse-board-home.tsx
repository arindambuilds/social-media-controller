"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Bot,
  MessageCircle,
  Radio,
  Send,
  Sparkles,
  TrendingUp,
  Users
} from "lucide-react";
import { PulseCard } from "./pulse-card";
import { PulseButton } from "./pulse-button";
import { ConversationPulseWidget } from "./conversation-pulse-widget";

export type PulseBoardHomeProps = {
  greeting: string;
  subtitle?: string;
  /** Live SSE / realtime */
  liveConnected?: boolean;
  /** Bump pulse when messages refresh */
  pulseBumpKey?: number | string;
  /** Metric numbers — wire to /api when available */
  metrics: {
    conversationsToday: number | null;
    queuedMessages: number | null;
    campaignsRunning: number | null;
    responseRatePct: number | null;
  };
  statsLoading?: boolean;
};

function MetricSkeleton() {
  return <div className="skeleton h-9 w-24 rounded-lg" />;
}

export function PulseBoardHome({
  greeting,
  subtitle,
  liveConnected,
  pulseBumpKey,
  metrics,
  statsLoading
}: PulseBoardHomeProps) {
  const router = useRouter();

  const items = [
    {
      label: "Today’s chats",
      value: metrics.conversationsToday,
      hint: "WhatsApp threads with activity",
      icon: Users
    },
    {
      label: "Queued sends",
      value: metrics.queuedMessages,
      hint: "Broadcasts & journeys waiting",
      icon: Send
    },
    {
      label: "Campaigns live",
      value: metrics.campaignsRunning,
      hint: "Automations currently running",
      icon: Radio
    },
    {
      label: "Response rate",
      value: metrics.responseRatePct != null ? `${metrics.responseRatePct.toFixed(0)}%` : null,
      hint: "Last 7 days (stub)",
      icon: TrendingUp
    }
  ] as const;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-mango-400">PulseBoard</p>
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">{greeting}</h2>
          {subtitle ? <p className="mt-2 max-w-2xl text-sm text-muted">{subtitle}</p> : null}
        </div>
        {liveConnected ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-mint-500/40 bg-mint-500/10 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-mint-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-400 opacity-40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-mint-400" />
            </span>
            Live
          </span>
        ) : null}
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map(({ label, value, hint, icon: Icon }) => (
          <PulseCard key={label} className="p-5" variant="default">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted">{label}</p>
                <div className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">
                  {statsLoading ? <MetricSkeleton /> : value != null ? value : "—"}
                </div>
                <p className="mt-2 text-xs text-muted">{hint}</p>
              </div>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-mango-500/15 text-mango-400">
                <Icon size={20} strokeWidth={2} aria-hidden />
              </span>
            </div>
          </PulseCard>
        ))}
      </div>

      <ConversationPulseWidget live={Boolean(liveConnected)} bumpKey={pulseBumpKey} />

      <PulseCard className="p-6" variant="accent">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-accent-purple">Quick actions</p>
            <p className="mt-1 font-display text-lg font-bold text-ink">Do the next delightful thing</p>
            <p className="mt-1 text-sm text-muted">Big buttons, tiny celebrations — built for busy shop owners.</p>
          </div>
          <Sparkles className="hidden text-accent-purple/40 sm:block" size={40} aria-hidden />
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["Broadcast", "/campaigns", Send],
              ["Journey", "/campaigns", Radio],
              ["Reports", "/reports", BarChart3],
              ["Test bot", "/conversations", Bot]
            ] as const
          ).map(([label, href, Icon]) => (
            <Link
              key={label}
              href={href}
              className="group flex items-center gap-3 rounded-2xl border border-subtle bg-canvas/80 px-4 py-4 text-left transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-mango-500/40 hover:shadow-lg"
            >
              <span className="pulse-icon-wiggle grid h-10 w-10 place-items-center rounded-xl bg-mango-500/15 text-mango-400">
                <Icon size={18} strokeWidth={2} aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-bold text-ink">{label}</span>
                <span className="text-xs text-muted">Open in studio</span>
              </span>
            </Link>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <PulseButton type="button" onClick={() => router.push("/conversations")}>
            <MessageCircle size={18} />
            Open inbox
          </PulseButton>
          <PulseButton type="button" variant="secondary" onClick={() => router.push("/analytics")}>
            Instagram analytics
          </PulseButton>
        </div>
      </PulseCard>
    </div>
  );
}
