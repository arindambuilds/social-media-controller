"use client";

import { useEffect, useState } from "react";
import { Radio } from "lucide-react";

type ConversationPulseWidgetProps = {
  /** When true, shows a soft repeating pulse (e.g. SSE connected) */
  live?: boolean;
  /** Label for screen readers */
  label?: string;
  /** Optional tick — bump pulse when this changes */
  bumpKey?: string | number;
};

/**
 * Central “Conversation pulse” — subtle animation when activity is present.
 * Respects prefers-reduced-motion via Tailwind `motion-safe:`.
 */
export function ConversationPulseWidget({
  live = true,
  label = "Conversation pulse",
  bumpKey = 0
}: ConversationPulseWidgetProps) {
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    setFlash(true);
    const t = window.setTimeout(() => setFlash(false), 600);
    return () => window.clearTimeout(t);
  }, [bumpKey]);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-mint-500/25 bg-gradient-to-br from-mint-600/15 via-surface to-surface p-5 shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
      aria-label={label}
    >
      <div className="flex items-center gap-4">
        <div className="relative grid h-14 w-14 place-items-center">
          <span
            className={`absolute inset-0 rounded-2xl bg-mint-500/25 motion-safe:animate-pulse-soft ${
              live ? "opacity-100" : "opacity-40"
            }`}
            aria-hidden
          />
          <span
            className={`absolute inset-0 rounded-2xl bg-mint-400/20 motion-safe:transition-transform motion-safe:duration-500 ${
              flash ? "motion-safe:scale-110" : "scale-100"
            }`}
            aria-hidden
          />
          <Radio
            className="relative text-mint-400 motion-safe:transition-transform motion-safe:duration-300 pulse-icon-wiggle"
            size={28}
            strokeWidth={2}
            aria-hidden
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-mint-400">Conversation pulse</p>
          <p className="mt-1 font-display text-lg font-bold tracking-tight text-ink">
            {live ? "Listening for new WhatsApp messages" : "Connect your workspace to go live"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {live
              ? "We’ll gently pulse when something new lands — no noisy banners."
              : "Hook up WhatsApp automation to see live activity here."}
          </p>
        </div>
      </div>
    </div>
  );
}
