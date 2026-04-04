"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "../../context/auth-context";
import { AppShell } from "./app-shell";

const SHELLLESS_PATTERNS = [/^\/login/, /^\/pricing/, /^\/success/, /^\/onboarding/, /^\/briefing\/share/];

function FullScreenLoader() {
  return (
    <div className="app-background pulse-loader-screen">
      <div className="pulse-loader-mark">PulseOS</div>
      <div className="pulse-loader-dots" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <p>Getting your dashboard ready…</p>
    </div>
  );
}

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const { token, isReady } = useAuth();
  const shellless = SHELLLESS_PATTERNS.some((pattern) => pattern.test(pathname));

  if (shellless) {
    return <div className="app-background">{children}</div>;
  }

  if (!isReady) {
    return <FullScreenLoader />;
  }

  if (!token) {
    return <div className="app-background">{children}</div>;
  }

  return <AppShell>{children}</AppShell>;
}

