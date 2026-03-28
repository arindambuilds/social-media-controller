"use client";

import { useAuth } from "../context/auth-context";

/** Blocks page content until localStorage token is read — avoids blank flash before redirects. */
export function AuthReadyGate({ children }: Readonly<{ children: React.ReactNode }>) {
  const { isReady } = useAuth();
  if (!isReady) {
    return (
      <div
        className="page-shell"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "45vh"
        }}
      >
        <div className="spinner" aria-label="Loading session" />
      </div>
    );
  }
  return <>{children}</>;
}
