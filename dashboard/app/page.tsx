"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/auth-context";

export default function HomePage() {
  const router = useRouter();
  const { token, isReady } = useAuth();

  useEffect(() => {
    if (!isReady) return;
    router.replace(token ? "/dashboard" : "/login");
  }, [isReady, token, router]);

  return (
    <div className="pulse-loader-screen app-background">
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
