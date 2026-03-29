"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../context/auth-context";

const LOGIN_TIMEOUT_MS = 90_000;

export default function LoginPage() {
  const router = useRouter();
  const { setSession, token, isReady } = useAuth();
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

  useEffect(() => {
    if (!isReady) return;
    if (token) router.replace("/dashboard");
  }, [isReady, token, router]);

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
    <div className="page-shell flex min-h-[calc(100vh-80px)] flex-col justify-center py-10 sm:py-16">
      <div className="mx-auto w-full max-w-[440px]">
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-accent-purple/35 bg-[linear-gradient(145deg,rgba(108,99,255,0.22),rgba(0,212,170,0.14))] shadow-glow"
            aria-hidden
          >
            <Sparkles className="text-accent-teal" size={32} strokeWidth={1.75} />
          </div>
          <p className="text-accent-purple mb-2 text-[0.6875rem] font-bold uppercase tracking-[0.16em]">Welcome back</p>
          <h1 className="text-ink font-display text-[clamp(1.75rem,4vw,2.25rem)] font-bold tracking-[-0.035em]">
            Sign in to Pulse
          </h1>
          <p className="text-muted mx-auto mt-3 max-w-sm text-[1.0625rem] leading-relaxed">
            Your analytics, AI insights, and caption tools — one calm, focused workspace.
          </p>
        </div>

        <div className="gradient-border p-8 sm:p-9">
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              void onLogin();
            }}
          >
            <div>
              <label className="text-muted mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor="login-email">
                Email
              </label>
              <input
                id="login-email"
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label
                className="text-muted mb-1 block text-xs font-bold uppercase tracking-wide"
                htmlFor="login-password"
              >
                Password
              </label>
              <input
                id="login-password"
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-purple to-accent-teal py-3.5 text-sm font-bold text-[#f0f0ff] shadow-glow transition-transform duration-200 hover:scale-[1.01] hover:shadow-teal active:scale-[0.99] disabled:pointer-events-none disabled:opacity-55"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-[18px] w-[18px] shrink-0 animate-spin" aria-hidden />
                  Signing in…
                </>
              ) : (
                "Continue"
              )}
            </button>

            {submitting && slowBackendHint ? (
              <p className="text-muted m-0 text-center text-sm leading-relaxed">
                Backend is starting up, please wait… (Render free tier can take up to ~50 seconds after sleep.)
              </p>
            ) : null}
            {error ? <p className="text-error m-0 text-center text-sm">{error}</p> : null}
          </form>
        </div>
      </div>
    </div>
  );
}
