"use client";

import { useEffect, type ReactElement } from "react";

type MicroRewardToastProps = {
  show: boolean;
  onDismiss: () => void;
  message?: string;
};

export function MicroRewardToast({
  show,
  onDismiss,
  message = "You're set — your first briefing is on the way."
}: MicroRewardToastProps): ReactElement | null {
  useEffect(() => {
    if (!show) return;
    const t = window.setTimeout(() => onDismiss(), 4500);
    return () => window.clearTimeout(t);
  }, [show, onDismiss]);

  if (!show) return null;

  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-[60] w-[min(92vw,360px)] -translate-x-1/2 rounded-2xl border border-[#00D4AA]/40 bg-[#0f111b] px-4 py-3 text-center text-sm text-white shadow-xl shadow-[#00D4AA]/10"
    >
      <span className="text-[#00D4AA]" aria-hidden>
        ✓
      </span>{" "}
      {message}
    </div>
  );
}
