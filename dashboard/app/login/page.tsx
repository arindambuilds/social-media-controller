"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "../../components/ui/page-header";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../context/auth-context";

const LOGIN_TIMEOUT_MS = 90_000;

export default function LoginPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  /** Demo defaults: primary operator (README / docs/DEMO.md). */
  const [email, setEmail] = useState("demo@demo.com");
  const [password, setPassword] = useState("Demo1234!");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [slowBackendHint, setSlowBackendHint] = useState(false);

  useEffect(() => {
    if (!submitting) {
      setSlowBackendHint(false);
      return;
    }
    const t = setTimeout(() => setSlowBackendHint(true), 5000);
    return () => clearTimeout(t);
  }, [submitting]);

  async function onLogin() {
    setError("");
    setSubmitting(true);
    setSlowBackendHint(false);
    try {
      const payload = await apiFetch<{
        success: boolean;
        accessToken: string;
        refreshToken: string;
        user: { clientId?: string | null };
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        timeoutMs: LOGIN_TIMEOUT_MS
      });

      setSession(payload.accessToken, payload.user.clientId ?? null, payload.refreshToken);
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-shell">
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <PageHeader
          eyebrow="Welcome back"
          title="Sign in to Pulse"
          description="Your analytics, AI insights, and caption tools — one calm, focused workspace."
        />
        <section className="panel">
          <div className="form-grid">
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />
            <button type="button" className="button" onClick={onLogin} disabled={submitting}>
              {submitting ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                  <span className="spinner" style={{ width: 18, height: 18 }} aria-hidden />
                  Signing in…
                </span>
              ) : (
                "Continue"
              )}
            </button>
            {submitting && slowBackendHint ? (
              <p className="muted" style={{ margin: 0, lineHeight: 1.45 }}>
                Backend is starting up, please wait… (Render free tier can take up to ~50 seconds after sleep.)
              </p>
            ) : null}
            {error ? <p className="text-error">{error}</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
