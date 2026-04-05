"use client";

import { Link2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, fetchMe } from "../../lib/api";
import { getAccessToken } from "../../lib/auth-storage";
import { ListPageSkeleton, TableFallbackSkeleton } from "../../components/page-skeleton";
import { PageHeader } from "../../components/ui/page-header";
import { useToast } from "../../context/toast-context";
import { usePageEnter } from "../../hooks/usePageEnter";

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

function formatPlatformLabel(platform: string): string {
  const value = platform.trim().toLowerCase();
  if (!value) return "Account";
  return value[0]!.toUpperCase() + value.slice(1);
}

function AccountsPageContent() {
  const pathname = usePathname();
  const pageClassName = usePageEnter();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [clientId, setClientId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [error, setError] = useState("");
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const handledSuccessRef = useRef<string | null>(null);

  const load = useCallback(async (cid: string) => {
    try {
      const data = await apiFetch<{ accounts?: AccountRow[]; data?: AccountRow[] }>(
        `/social-accounts?clientId=${encodeURIComponent(cid)}`
      );
      setAccounts(data.accounts ?? data.data ?? []);
    } catch (e) {
      console.error("[accounts page]", e);
      setAccounts([]);
    }
  }, []);

  useEffect(() => {
    const err = searchParams?.get("oauth_error") ?? null;
    const oauthSuccess = searchParams?.get("oauth_success") ?? null;
    const connected = searchParams?.get("connected") ?? null;
    const success = oauthSuccess || connected;
    setOauthError(err ? decodeURIComponent(err) : null);
    if (!success) {
      handledSuccessRef.current = null;
      return;
    }
    if (handledSuccessRef.current === success) return;

    handledSuccessRef.current = success;
    const platform = formatPlatformLabel(success);
    toast.success(`${platform} connected successfully!`, "Data sync will begin shortly. First results appear within a few minutes.");
    router.replace("/accounts");
  }, [router, searchParams, toast]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    (async () => {
      try {
        const me = await fetchMe();
        let cid = me.user.clientId;
        if (me.user.role === "AGENCY_ADMIN" && !cid) {
          cid = "demo-client";
        }
        if (me.user.role === "CLIENT_USER" && !cid) {
          setError("No client assigned.");
          setLoading(false);
          return;
        }
        if (cid) {
          setClientId(cid);
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
    const token = getAccessToken();
    if (!token) return;
    setBusy(path);
    setError("");
    try {
      const data = await apiFetch<{ authUrl: string }>(path, {
        method: "POST",
        body: JSON.stringify({ clientId })
      });
      window.location.href = data.authUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connect failed");
      setBusy(null);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Remove this connected account?")) return;
    try {
      await apiFetch(`/social-accounts/${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      return;
    }
    if (clientId) await load(clientId);
  }

  if (loading) {
    return (
      <div key={pathname} className={pageClassName}>
        <ListPageSkeleton label="Loading accounts…" />
      </div>
    );
  }

  return (
    <div key={pathname} className={`page-shell ${pageClassName}`}>
      <PageHeader
        eyebrow="Channels"
        title="Social accounts"
        description="Connect Facebook, Instagram, or LinkedIn. Redirect returns here after OAuth."
      />
      {oauthError && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-red-400/20 bg-red-400/8 px-4 py-3">
          <span className="shrink-0 text-lg">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-red-300">Instagram connection failed</p>
            <p className="mt-0.5 text-xs text-red-300/60">
              {oauthError === "access_denied"
                ? "You declined the Instagram permission request."
                : oauthError === "token_exchange_failed"
                  ? "Could not exchange the auth code. Please try again."
                  : `Error: ${oauthError}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.replace("/accounts")}
            className="ml-auto text-lg leading-none text-red-400/60 hover:text-red-400"
          >
            ✕
          </button>
        </div>
      )}
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

      {!loading && accounts.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 text-white/30">
          <span className="text-3xl">📱</span>
          <p className="text-sm">No accounts connected yet</p>
          <p className="text-xs text-white/20">Connect an Instagram account to start tracking performance</p>
          <Link className="button mt-1 inline-block" href="/onboarding">
            Open setup
          </Link>
        </div>
      ) : (
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
      )}
    </div>
  );
}

export default function AccountsPage() {
  return (
    <Suspense fallback={<TableFallbackSkeleton />}>
      <AccountsPageContent />
    </Suspense>
  );
}
