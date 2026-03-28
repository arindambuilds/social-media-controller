"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "../../components/ui/page-header";
import { apiFetch, fetchMe } from "../../lib/api";
import { useAuth } from "../../context/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [email, setEmail] = useState("demo@demo.com");
  const [password, setPassword] = useState("Demo1234!");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onLogin() {
    setError("");
    setSubmitting(true);
    try {
      const payload = await apiFetch<{
        success: boolean;
        accessToken: string;
        user: { clientId?: string | null };
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });

      const me = await fetchMe(payload.accessToken);
      setSession(payload.accessToken, me.user.clientId ?? null);

      router.push("/analytics");
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
              {submitting ? "Signing in…" : "Continue"}
            </button>
            {error ? <p className="text-error">{error}</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

