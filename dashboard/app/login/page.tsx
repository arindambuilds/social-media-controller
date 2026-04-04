"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { useAuth } from "../../context/auth-context";
import { useToast } from "../../context/toast-context";
import { usePageTitle } from "../../hooks/usePageTitle";
import { apiFetch } from "../../lib/api";

const LOGIN_TIMEOUT_MS = 90_000;

export default function LoginPage() {
  const router = useRouter();
  const { setSession, token, isReady } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  usePageTitle("Login");

  useEffect(() => {
    if (isReady && token) router.replace("/dashboard");
  }, [isReady, token, router]);

  const canSubmit = useMemo(() => email.trim().length > 0 && password.trim().length >= 8, [email, password]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || submitting) return;

    setError(null);
    setSubmitting(true);
    setSuccess(false);

    try {
      const payload = await apiFetch<{
        success: boolean;
        accessToken: string;
        user: { clientId?: string | null };
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        timeoutMs: LOGIN_TIMEOUT_MS
      });

      setSession(payload.accessToken);
      setSuccess(true);
      toast.success("Done! ✓", "Your dashboard is ready.");
      window.setTimeout(() => router.push("/dashboard"), 550);
    } catch {
      const message = "Invalid email or password";
      setError(message);
      toast.error("Something went sideways — let’s try again", message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="login-mobile-bar">PulseOS</div>
      <section className="login-shell">
        <aside className="login-brand-panel">
          <div className="login-dot-grid" aria-hidden />
          <div className="login-brand-content page-enter is-ready">
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "32px" }}>
              <img
                src="/logo.png"
                alt="PulseOS"
                width={220}
                style={{ height: "auto", animation: "fadeIn 400ms var(--ease-enter) forwards" }}
              />
            </div>
            <p className="login-brand-tagline">
              <span>Your</span>{" "}
              <span>WhatsApp.</span>{" "}
              <span>Automated.</span>
            </p>
            <div className="login-feature-pills">
              <div className="feature-pill">✓ AI-powered replies</div>
              <div className="feature-pill">✓ Instant PDF reports</div>
              <div className="feature-pill">✓ Built for Odisha MSMEs</div>
            </div>
          </div>
        </aside>

        <div className="login-panel">
          <div className="login-card page-enter is-ready">
            <img
              src="/logo.png"
              alt="PulseOS"
              width={80}
              style={{
                height: "auto",
                marginBottom: "24px",
                borderRadius: "12px",
                padding: "8px 16px",
                background: "white"
              }}
            />
            <h1>Welcome back 👋</h1>
            <p>Sign in to see your WhatsApp dashboard.</p>

            <form className="login-form" onSubmit={handleLogin}>
              <Input label="Email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              <Input
                label="Password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                error={error}
              />
              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={submitting && !success}
                success={success}
                disabled={!canSubmit}
              >
                Sign in
              </Button>
            </form>

            <p className="login-footer">
              Need help? <a href="mailto:support@pulseos.in">support@pulseos.in</a>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

