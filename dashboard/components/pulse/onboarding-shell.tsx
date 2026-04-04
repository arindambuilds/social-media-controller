"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { PulseToastProvider } from "./pulse-toast";

export function OnboardingShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <PulseToastProvider>
      <div className="pulse-studio-bg min-h-[calc(100vh-64px)]">
        <div className="mx-auto max-w-xl px-4 py-8 sm:py-12">
          <div className="mb-8 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-mango-400 to-mint-500 text-canvas shadow-lg">
                <Sparkles size={20} strokeWidth={2.5} aria-hidden />
              </span>
              <div>
                <p className="font-display text-sm font-bold text-ink">PulseOS</p>
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted">Welcome in</p>
              </div>
            </div>
            <Link
              href="/dashboard"
              className="rounded-xl border border-subtle bg-surface px-3 py-2 text-xs font-semibold text-muted transition-colors hover:border-mint-500/35 hover:text-mint-400"
            >
              Skip to dashboard
            </Link>
          </div>
          {children}
        </div>
      </div>
    </PulseToastProvider>
  );
}
