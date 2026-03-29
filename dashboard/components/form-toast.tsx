"use client";

import { useEffect } from "react";

export type FormToastVariant = "success" | "error";

type FormToastProps = {
  message: string | null;
  variant: FormToastVariant;
  onDismiss: () => void;
  durationMs?: number;
};

/**
 * Fixed snackbar for form save feedback (matches Pulse shell — no extra dependencies).
 */
export function FormToast({ message, variant, onDismiss, durationMs = 4200 }: FormToastProps) {
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => onDismiss(), durationMs);
    return () => window.clearTimeout(t);
  }, [message, onDismiss, durationMs]);

  if (!message) return null;

  const isSuccess = variant === "success";

  return (
    <div
      className="pointer-events-none fixed bottom-6 left-1/2 z-[200] flex w-[min(100%,420px)] -translate-x-1/2 justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <div
        className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg ${
          isSuccess
            ? "border-accent-teal/40 bg-[rgba(0,212,170,0.14)] text-accent-teal"
            : "border-danger/45 bg-danger/15 text-danger"
        }`}
      >
        {message}
      </div>
    </div>
  );
}
