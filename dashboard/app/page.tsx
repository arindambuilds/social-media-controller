"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/auth-context";

/** Root: send signed-in users to the dashboard; others to login (no manual token UI). */
export default function HomePage() {
  const router = useRouter();
  const { token, isReady } = useAuth();

  useEffect(() => {
    if (!isReady) return;
    router.replace(token ? "/dashboard" : "/login");
  }, [isReady, token, router]);

  return (
    <div className="page-shell">
      <div className="panel" style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <div className="spinner" aria-label="Redirecting" />
      </div>
    </div>
  );
}
