"use client";

/** page-enter: `usePageEnter` + `key={pathname}` on the root wrapper (CallbackInner). */

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePageEnter } from "@/hooks/usePageEnter";
import { Suspense, useEffect, useState } from "react";
import { apiFetch, fetchMe } from "../../../lib/api";
import { getAccessToken } from "../../../lib/auth-storage";

function CallbackInner() {
  const pathname = usePathname();
  const pageClassName = usePageEnter();
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams?.get("code");
  const state = searchParams?.get("state");
  const missingOauthParams = !code || !state;
  const [phase, setPhase] = useState<"working" | "success" | "error">(
    missingOauthParams ? "error" : "working"
  );
  const [message, setMessage] = useState(missingOauthParams ? "Missing OAuth code or state." : "");
  const [postsSynced, setPostsSynced] = useState(0);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    if (missingOauthParams) {
      return;
    }

    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let pollCount = 0;

    (async () => {
      try {
        let clientId: string;
        try {
          const me = await fetchMe();
          const cid = me.user.clientId;
          if (!cid) {
            if (!cancelled) {
              setPhase("error");
              setMessage("Missing client ID. Log in again.");
            }
            return;
          }
          clientId = cid;
        } catch {
          if (!cancelled) {
            setPhase("error");
            setMessage("Could not load your account.");
          }
          return;
        }

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
  }, [router, code, state, missingOauthParams]);

  if (phase === "working") {
    return (
      <div key={pathname} className={`page-shell ${pageClassName}`}>
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
      <div key={pathname} className={`page-shell ${pageClassName}`}>
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
    <div key={pathname} className={`page-shell ${pageClassName}`}>
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
