"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  LayoutGrid,
  Menu,
  MessageCircle,
  Settings,
  Sparkles,
  X,
  Zap
} from "lucide-react";
import { PulseToastProvider } from "./pulse-toast";

const NAV = [
  { href: "/dashboard", label: "PulseBoard", icon: LayoutGrid },
  { href: "/conversations", label: "Conversations", icon: MessageCircle },
  { href: "/campaigns", label: "Campaigns", icon: Zap },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings }
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard" || pathname === "/dashboard/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export type PulseShellProps = {
  children: React.ReactNode;
  /** Shown in the top bar on desktop */
  title?: string;
  /** Optional right-side slot (filters, date range) */
  topBar?: React.ReactNode;
};

export function PulseStudioShell({ children, title, topBar }: PulseShellProps) {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    close();
  }, [pathname, close]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <PulseToastProvider>
      <div className="pulse-studio-bg min-h-[calc(100vh-64px)]">
        <div className="mx-auto flex max-w-[1600px]">
          {/* Desktop sidebar */}
          <aside className="sticky top-[64px] hidden h-[calc(100vh-64px)] w-64 shrink-0 flex-col border-r border-subtle bg-nav-bg/95 py-6 pl-4 pr-3 backdrop-blur-md md:flex">
            <div className="mb-6 flex items-center gap-2 px-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-mango-400 to-mint-500 text-canvas shadow-lg">
                <Sparkles size={18} strokeWidth={2.5} aria-hidden />
              </span>
              <div>
                <p className="font-display text-sm font-bold leading-tight text-ink">PulseOS</p>
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted">Studio</p>
              </div>
            </div>
            <nav className="flex flex-1 flex-col gap-1" aria-label="PulseOS">
              {NAV.map(({ href, label, icon: Icon }) => {
                const on = isActive(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                      on
                        ? "bg-white/10 text-ink shadow-inner"
                        : "text-muted hover:bg-white/5 hover:text-ink"
                    }`}
                  >
                    <Icon
                      size={18}
                      strokeWidth={2}
                      className={`shrink-0 ${on ? "text-mango-400" : "text-muted group-hover:text-mango-300"}`}
                      aria-hidden
                    />
                    {label}
                  </Link>
                );
              })}
            </nav>
            <Link
              href="/onboarding"
              className="mt-auto rounded-xl border border-dashed border-mango-500/35 bg-mango-500/5 px-3 py-3 text-xs font-semibold text-mango-400 transition-colors hover:border-mango-500/55 hover:bg-mango-500/10"
            >
              Finish setup tips →
            </Link>
          </aside>

          {/* Mobile drawer */}
          <div className="flex min-w-0 flex-1 flex-col md:hidden">
            <div className="sticky top-[64px] z-40 flex items-center justify-between gap-3 border-b border-subtle bg-nav-bg/90 px-4 py-3 backdrop-blur-md">
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-bold text-ink">{title ?? "PulseOS"}</p>
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted">Studio</p>
              </div>
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-subtle bg-surface text-ink"
                aria-label={open ? "Close menu" : "Open menu"}
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
              >
                {open ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
            {open ? (
              <div className="fixed inset-0 z-50 md:hidden">
                <button type="button" className="absolute inset-0 bg-black/55" aria-label="Close menu" onClick={close} />
                <nav
                  className="absolute right-0 top-0 flex h-full w-[min(100%,20rem)] flex-col gap-1 border-l border-subtle bg-nav-bg p-4 pt-16 shadow-2xl"
                  aria-label="PulseOS mobile"
                >
                  {NAV.map(({ href, label, icon: Icon }) => {
                    const on = isActive(pathname, href);
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${
                          on ? "bg-white/10 text-ink" : "text-muted"
                        }`}
                        onClick={close}
                      >
                        <Icon size={18} className={on ? "text-mango-400" : "text-muted"} aria-hidden />
                        {label}
                      </Link>
                    );
                  })}
                  <Link
                    href="/onboarding"
                    className="mt-4 rounded-xl border border-mango-500/35 px-3 py-3 text-center text-xs font-bold text-mango-400"
                    onClick={close}
                  >
                    Setup wizard
                  </Link>
                </nav>
              </div>
            ) : null}
          </div>

          <div className="min-w-0 flex-1">
            <div className="sticky top-[64px] z-30 hidden items-center justify-between gap-4 border-b border-subtle bg-canvas/80 px-6 py-4 backdrop-blur-md md:flex">
              <div>
                <h1 className="font-display text-xl font-bold tracking-tight text-ink">{title ?? "PulseOS"}</h1>
                <p className="text-xs text-muted">Friendly automation for Odisha MSMEs</p>
              </div>
              {topBar ? <div className="flex flex-wrap items-center gap-2">{topBar}</div> : null}
            </div>
            <div className="px-4 py-6 md:px-8 md:py-8">{children}</div>
          </div>
        </div>
      </div>
    </PulseToastProvider>
  );
}
