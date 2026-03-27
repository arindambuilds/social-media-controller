"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "../../components/ui/page-header";
import { fetchMe } from "../../lib/api";
import { CLIENT_ID_KEY, TOKEN_KEY } from "../../lib/auth-storage";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@demo.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");

  async function onLogin() {
    setError("");
    const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    const response = await fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      setError(await response.text());
      return;
    }

    const payload = (await response.json()) as {
      success: boolean;
      accessToken: string;
      user: { clientId?: string | null };
    };

    localStorage.setItem(TOKEN_KEY, payload.accessToken);

    const me = await fetchMe(payload.accessToken);
    if (me.user.clientId) {
      localStorage.setItem(CLIENT_ID_KEY, me.user.clientId);
    } else {
      localStorage.removeItem(CLIENT_ID_KEY);
    }

    router.push("/analytics");
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
            <button type="button" className="button" onClick={onLogin}>
              Continue
            </button>
            {error ? <p className="text-error">{error}</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

