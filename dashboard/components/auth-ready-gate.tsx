"use client";

import { useAuth } from "../context/auth-context";

/** Blocks page content until auth bootstrap finishes — avoids blank flash before redirects. */
export function AuthReadyGate({ children }: Readonly<{ children: React.ReactNode }>) {
  const { isReady } = useAuth();
  if (!isReady) {
    return (
      <div className="page-shell flex min-h-[45vh] flex-col items-center justify-center py-16">
        <div className="gradient-border flex items-center justify-center px-12 py-10">
          <div className="spinner" aria-label="Loading session" />
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
