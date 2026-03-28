"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { apiFetch, fetchMe } from "../../lib/api";
import { CLIENT_ID_KEY, getStoredClientId, getStoredToken } from "../../lib/auth-storage";
import { PageHeader } from "../../components/ui/page-header";

type AccountRow = {
  id: string;
  platform: string;
  platformUsername: string | null;
  tokenExpiresAt: string | null;
  lastSyncedAt: string | null;
};

function msUntil(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime() - Date.now();
  if (t <= 0) return "expired";
  const d = Math.floor(t / 86400000);
  const h = Math.floor((t % 86400000) / 3600000);
  return d > 0 ? `${d}d ${h}h` : `${h}h`;
}

function AccountsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [clientId, setClientId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (cid: string) => {
    const res = await apiFetch(`/social-accounts?clientId=${encodeURIComponent(cid)}`);
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as { accounts: AccountRow[] };
    setAccounts(data.accounts ?? []);
  }, []);

  useEffect(() => {
    const oauthErr = searchParams.get("oauth_error");
    if (oauthErr) setError(decodeURIComponent(oauthErr));
  }, [searchParams]);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    (async () => {
      try {
        const me = await fetchMe(token);
        let cid = getStoredClientId() ?? me.user.clientId;
        if (me.user.role === "AGENCY_ADMIN" && !cid) {
          cid = "demo-client";
          localStorage.setItem(CLIENT_ID_KEY, cid);
        }
        if (me.user.role === "CLIENT_USER" && !cid) {
          setError("No client assigned.");
          setLoading(false);
          return;
        }
        if (cid) {
          setClientId(cid);
          localStorage.setItem(CLIENT_ID_KEY, cid);
          await load(cid);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [router, load]);

  async function connect(path: string) {
    if (!clientId) return;
    const token = getStoredToken();
    if (!token) return;
    setBusy(path);
    setError("");
    try {
      const res = await apiFetch(path, {
        method: "POST",
        body: JSON.stringify({ clientId })
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { authUrl: string };
      window.location.href = data.authUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connect failed");
      setBusy(null);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Remove this connected account?")) return;
    const res = await apiFetch(`/social-accounts/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    if (clientId) await load(clientId);
  }

  if (loading) {
    return (
      <div className="page-shell">
        <div className="skeleton" style={{ height: 120 }} />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Channels"
        title="Social accounts"
        description="Connect Facebook, Instagram, or LinkedIn. Redirect returns here after OAuth."
      />
      {error ? <p className="text-error" style={{ marginBottom: 16 }}>{error}</p> : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 28 }}>
        <button
          type="button"
          className="btn-primary"
          disabled={!!busy || !clientId}
          onClick={() => connect("/social-accounts/connect/facebook")}
        >
          Connect Facebook
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={!!busy || !clientId}
          onClick={() => connect("/social-accounts/connect/instagram")}
        >
          Connect Instagram
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={!!busy || !clientId}
          onClick={() => connect("/social-accounts/connect/linkedin")}
        >
          Connect LinkedIn
        </button>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Platform</th>
              <th>Handle</th>
              <th>Token expiry (est.)</th>
              <th>Last sync</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td>{a.platform}</td>
                <td>{a.platformUsername ?? "—"}</td>
                <td>{msUntil(a.tokenExpiresAt)}</td>
                <td>{a.lastSyncedAt ? new Date(a.lastSyncedAt).toLocaleString() : "—"}</td>
                <td>
                  <button type="button" className="btn-secondary" onClick={() => revoke(a.id)}>
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AccountsPage() {
  return (
    <Suspense
      fallback={
        <div className="page-shell">
          <div className="skeleton" style={{ height: 120 }} />
        </div>
      }
    >
      <AccountsPageContent />
    </Suspense>
  );
}
