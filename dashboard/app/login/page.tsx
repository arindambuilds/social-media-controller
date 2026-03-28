"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "../../components/ui/page-header";
import { API_ORIGIN, fetchMe } from "../../lib/api";
import { useAuth } from "../../context/auth-context";

async function readLoginError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const j = JSON.parse(text) as { error?: string };
    if (j?.error) return j.error;
  } catch {
    /* plain text */
  }
  return text || `Sign-in failed (${response.status})`;
}

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
      const response = await fetch(`${API_ORIGIN}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        setError(await readLoginError(response));
        return;
      }

      const payload = (await response.json()) as {
        success: boolean;
        accessToken: string;
        user: { clientId?: string | null };
      };

      const me = await fetchMe(payload.accessToken);
      setSession(payload.accessToken, me.user.clientId ?? null);

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
              {submitting ? "Signing in…" : "Continue"}
            </button>
            {error ? <p className="text-error">{error}</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

