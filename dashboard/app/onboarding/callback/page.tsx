"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { getStoredClientId, getStoredToken } from "../../../lib/auth-storage";

function CallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<"working" | "success" | "error">("working");
  const [message, setMessage] = useState("");
  const [postsSynced, setPostsSynced] = useState(0);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    const code = searchParams?.get("code");
    const state = searchParams?.get("state");
    if (!code || !state) {
      setPhase("error");
      setMessage("Missing OAuth code or state.");
      return;
    }

    const clientId = getStoredClientId();
    if (!clientId) {
      setPhase("error");
      setMessage("Missing client ID. Log in again.");
      return;
    }

    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let pollCount = 0;

    (async () => {
      try {
        try {
          await apiFetch(
            `/auth/oauth/instagram/callback?${new URLSearchParams({ code, state }).toString()}`
          );
        } catch (err) {
          if (!cancelled) {
            setPhase("error");
            setMessage(err instanceof Error ? err.message : "OAuth callback failed.");
          }
          return;
        }

        const poll = async () => {
          pollCount += 1;
          let data: { status: string; postsSynced: number };
          try {
            data = await apiFetch(`/clients/${encodeURIComponent(clientId)}/sync-status`);
          } catch {
            return;
          }
          if (!cancelled) {
            setPostsSynced(data.postsSynced);
            if (data.status !== "syncing" || pollCount >= 40) {
              if (pollTimer) clearInterval(pollTimer);
              setPhase("success");
            }
          }
        };

        await poll();
        pollTimer = setInterval(poll, 3000);
      } catch (e) {
        if (!cancelled) {
          setPhase("error");
          setMessage(e instanceof Error ? e.message : "Unexpected error");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [router, searchParams]);

  if (phase === "working") {
    return (
      <div className="page-shell">
        <section className="panel span-12" style={{ textAlign: "center", padding: 48 }}>
          <div className="eyebrow">Step 2</div>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <div className="spinner" aria-label="Syncing" />
          </div>
          <h2>Syncing your posts...</h2>
          <p className="muted">Hang tight while we pull your latest Instagram content.</p>
        </section>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="page-shell">
        <section className="panel span-12">
          <h2>Something went wrong</h2>
          <p className="text-error">{message}</p>
          <div className="actions" style={{ marginTop: 16 }}>
            <Link className="button secondary" href="/onboarding">
              Back to onboarding
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <section className="panel span-12">
        <div className="eyebrow">Step 3</div>
        <h2>All set</h2>
        <p className="muted">{postsSynced} posts synced.</p>
        <div className="actions" style={{ marginTop: 16 }}>
          <Link className="button" href="/analytics">
            Go to analytics
          </Link>
        </div>
      </section>
    </div>
  );
}

export default function OnboardingCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="page-shell">
          <div className="panel" style={{ display: "flex", justifyContent: "center", padding: 48 }}>
            <div className="spinner" />
          </div>
        </div>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}
