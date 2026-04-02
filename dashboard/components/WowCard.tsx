"use client";

import type { ReactElement } from "react";

/** Tomorrow 9 AM briefing preview — WhatsApp bubble + clock emphasis for first session. */
export function WowCard({ animateClock = true }: { animateClock?: boolean }): ReactElement {
  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-[#0d1f18] to-[#0a0a0f] p-5 shadow-lg shadow-emerald-900/20">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-300/90">
        <span
          className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/10 text-lg ${animateClock ? "motion-safe:animate-pulse" : ""}`}
          aria-hidden
        >
          🕘
        </span>
        Tomorrow 9:00 AM · WhatsApp
      </div>
      <div className="mt-4 max-w-sm rounded-2xl rounded-tl-sm bg-[#1a2e24] px-4 py-3 text-sm leading-relaxed text-white/90 shadow-inner">
        <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-400/80">Preview</p>
        <p className="mt-1">
          Good morning! Here&apos;s your Daily Pulse — yesterday&apos;s leads, who to follow up with, and one tip to
          grow today. No app to open.
        </p>
      </div>
    </div>
  );
}
