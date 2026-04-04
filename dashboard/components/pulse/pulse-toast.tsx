"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { PartyPopper, Sparkles } from "lucide-react";

type ToastTone = "success" | "info" | "playful";

export type ToastInput = {
  message: string;
  tone?: ToastTone;
};

type ToastItem = ToastInput & { id: string };

type Ctx = {
  toast: (input: string | ToastInput) => void;
};

const PulseToastContext = createContext<Ctx | null>(null);

export function usePulseToast(): Ctx {
  const c = useContext(PulseToastContext);
  if (!c) {
    return {
      toast: () => {
        /* no-op outside provider */
      }
    };
  }
  return c;
}

function normalize(input: string | ToastInput): ToastItem {
  if (typeof input === "string") {
    return { id: crypto.randomUUID(), message: input, tone: "playful" };
  }
  return { id: crypto.randomUUID(), message: input.message, tone: input.tone ?? "playful" };
}

export function PulseToastProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((input: string | ToastInput) => {
    const t = normalize(input);
    setItems((prev) => [...prev, t]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((x) => x.id !== t.id));
    }, 3400);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <PulseToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[90] flex max-w-sm flex-col gap-2 p-2 sm:bottom-6 sm:right-6"
        aria-live="polite"
        aria-relevant="additions"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-lg backdrop-blur-sm motion-safe:animate-slide-up ${
              t.tone === "success"
                ? "border-mint-500/35 bg-mint-600/20 text-mint-400"
                : t.tone === "info"
                  ? "border-ocean-300/30 bg-ocean-900/80 text-ocean-100"
                  : "border-mango-500/40 bg-[#1a1208]/95 text-mango-400"
            }`}
          >
            <span className="mt-0.5 shrink-0" aria-hidden>
              {t.tone === "success" ? (
                <Sparkles size={18} strokeWidth={2} className="text-mint-400" />
              ) : (
                <PartyPopper size={18} strokeWidth={2} className="text-mango-400" />
              )}
            </span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </PulseToastContext.Provider>
  );
}
