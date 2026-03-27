"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, fetchMe } from "../../lib/api";
import { CLIENT_ID_KEY, getStoredClientId, getStoredToken } from "../../lib/auth-storage";

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [postsSynced, setPostsSynced] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    (async () => {
      try {
        const me = await fetchMe(token);
        const clientId = me.user.clientId;
        if (!clientId) {
          setError("No client is assigned to your account. Ask an admin to link a client.");
          setLoading(false);
          return;
        }
        localStorage.setItem(CLIENT_ID_KEY, clientId);

        const syncRes = await apiFetch(`/clients/${encodeURIComponent(clientId)}/sync-status`);
        const sync = syncRes.ok ? ((await syncRes.json()) as { postsSynced?: number }) : { postsSynced: 0 };
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
    const res = await apiFetch(
      `/auth/oauth/instagram/authorise?clientId=${encodeURIComponent(clientId)}`
    );
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    const data = (await res.json()) as { url: string };
    window.location.href = data.url;
  }

  if (loading) {
    return (
      <div className="page-shell">
        <div className="panel" style={{ display: "flex", justifyContent: "center", padding: 48 }}>
          <div className="spinner" aria-label="Loading" />
        </div>
      </div>
    );
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
        {error ? <p className="text-error">{error}</p> : null}
        <div className="actions" style={{ marginTop: 16 }}>
          <button type="button" className="button" onClick={connect}>
            Connect Instagram
          </button>
        </div>
      </section>
    </div>
  );
}
