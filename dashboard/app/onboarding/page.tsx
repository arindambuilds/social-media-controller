"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ListPageSkeleton } from "../../components/page-skeleton";
import { API_ORIGIN, apiFetch, fetchMe } from "../../lib/api";
import { CLIENT_ID_KEY, getStoredClientId, getStoredToken } from "../../lib/auth-storage";

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [postsSynced, setPostsSynced] = useState(0);
  const [error, setError] = useState("");
  const [ingestionMode, setIngestionMode] = useState<string | null>(null);
  const [metaConfigured, setMetaConfigured] = useState<boolean | null>(null);
  const [connectBusy, setConnectBusy] = useState(false);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    (async () => {
      try {
        const healthRes = await fetch(`${API_ORIGIN}/health`, { cache: "no-store" });
        if (healthRes.ok) {
          const h = (await healthRes.json()) as {
            ingestionMode?: string;
            instagramOAuthConfigured?: boolean;
          };
          setIngestionMode(h.ingestionMode ?? null);
          setMetaConfigured(h.instagramOAuthConfigured ?? null);
        }

        const me = await fetchMe();
        const clientId = me.user.clientId;
        if (!clientId) {
          setError("No client is assigned to your account. Ask an admin to link a client.");
          setLoading(false);
          return;
        }
        localStorage.setItem(CLIENT_ID_KEY, clientId);

        const sync = await apiFetch<{ postsSynced?: number }>(
          `/clients/${encodeURIComponent(clientId)}/sync-status`
        );
        setPostsSynced(sync.postsSynced ?? 0);

        if (me.instagramConnected) {
          setShowSuccess(true);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function connect() {
    setError("");
    const token = getStoredToken();
    const clientId = getStoredClientId();
    if (!token || !clientId) {
      router.push("/login");
      return;
    }
    setConnectBusy(true);
    try {
      const instagramUrl = `${API_ORIGIN}/api/auth/instagram?clientId=${encodeURIComponent(clientId)}`;
      const res = await fetch(instagramUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        redirect: "manual"
      });
      const loc = res.headers.get("Location");
      if (
        (res.status === 302 || res.status === 301 || res.status === 307 || res.status === 308) &&
        loc
      ) {
        window.location.href = loc;
        return;
      }

      try {
        const data = await apiFetch<{ url: string }>(
          `/auth/oauth/instagram/authorise?clientId=${encodeURIComponent(clientId)}`
        );
        window.location.href = data.url;
      } catch (e2) {
        setError(e2 instanceof Error ? e2.message : "Could not start Instagram OAuth.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start Instagram OAuth.");
    } finally {
      setConnectBusy(false);
    }
  }

  if (loading) {
    return <ListPageSkeleton label="Loading onboarding…" />;
  }

  if (showSuccess) {
    return (
      <div className="page-shell">
        <section className="panel span-12">
          <div className="eyebrow">Step 3</div>
          <h2>Instagram connected</h2>
          <p className="muted">{postsSynced} posts synced.</p>
          <div className="actions" style={{ marginTop: 16 }}>
            <Link className="button" href="/analytics">
              Open analytics
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <section className="panel span-12">
        <div className="eyebrow">Step 1</div>
        <h2>Connect Instagram</h2>
        <p className="muted">Authorize Meta to sync your posts. You will return here after signing in.</p>
        {ingestionMode === "mock" ? (
          <p className="muted" style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid var(--line)" }}>
            <strong>Demo mode:</strong> <code>INGESTION_MODE=mock</code> is active — sync uses synthetic data. Seeded posts
            already power analytics. For live Instagram, set Meta app credentials and <code>INGESTION_MODE=instagram</code>{" "}
            in the API <code>.env</code>.
          </p>
        ) : null}
        {ingestionMode === "instagram" && metaConfigured === false ? (
          <p className="muted" style={{ marginTop: 12 }}>
            Meta app ID is not configured on the API — OAuth will return an error until you add{" "}
            <code>INSTAGRAM_APP_ID</code> / <code>FACEBOOK_APP_ID</code> and secrets.
          </p>
        ) : null}
        {error ? <p className="text-error">{error}</p> : null}
        <div className="actions" style={{ marginTop: 16 }}>
          <button type="button" className="button" onClick={connect} disabled={connectBusy}>
            {connectBusy ? "Opening Meta…" : "Connect Instagram"}
          </button>
        </div>
      </section>
    </div>
  );
}
