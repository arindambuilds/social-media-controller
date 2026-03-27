/**
 * Quick API smoke test for demos and CI-style checks.
 * Requires: API running, DB seeded (admin@demo.com), migrations applied.
 *
 * Usage: SMOKE_BASE_URL=http://localhost:4000 npx tsx scripts/smoke-demo.ts
 */

const base = (process.env.SMOKE_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");
const email = process.env.SMOKE_EMAIL ?? "admin@demo.com";
const password = process.env.SMOKE_PASSWORD ?? "admin123";
const clientId = process.env.SMOKE_CLIENT_ID ?? "demo-client";

async function main() {
  const steps: string[] = [];

  const health = await fetch(`${base}/health`);
  if (!health.ok) throw new Error(`GET /health → ${health.status}`);
  steps.push("GET /health OK");

  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (!loginRes.ok) throw new Error(`POST /api/auth/login → ${loginRes.status} ${await loginRes.text()}`);
  const login = (await loginRes.json()) as { accessToken?: string };
  if (!login.accessToken) throw new Error("Login response missing accessToken");
  steps.push("POST /api/auth/login OK");

  const token = login.accessToken;
  const authHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const meRes = await fetch(`${base}/api/auth/me`, { headers: authHeaders });
  if (!meRes.ok) throw new Error(`GET /api/auth/me → ${meRes.status}`);
  steps.push("GET /api/auth/me OK");

  const overview = await fetch(`${base}/api/analytics/${encodeURIComponent(clientId)}/overview?days=30`, {
    headers: authHeaders
  });
  if (!overview.ok) throw new Error(`GET /analytics/.../overview → ${overview.status} ${await overview.text()}`);
  steps.push("GET /api/analytics/:clientId/overview OK");

  const summary = await fetch(`${base}/api/analytics/INSTAGRAM/${encodeURIComponent(clientId)}/summary`, {
    headers: authHeaders
  });
  if (!summary.ok) throw new Error(`GET /analytics/INSTAGRAM/.../summary → ${summary.status}`);
  steps.push("GET /api/analytics/INSTAGRAM/:clientId/summary OK");

  const insights = await fetch(
    `${base}/api/insights/${encodeURIComponent(clientId)}/content-performance/latest`,
    { headers: authHeaders }
  );
  if (!insights.ok) throw new Error(`GET /api/insights/.../latest → ${insights.status}`);
  steps.push("GET /api/insights/:clientId/content-performance/latest OK");

  const leads = await fetch(`${base}/api/leads?clientId=${encodeURIComponent(clientId)}`, {
    headers: authHeaders
  });
  if (!leads.ok) throw new Error(`GET /api/leads → ${leads.status}`);
  const leadsJson = (await leads.json()) as { leads?: unknown[]; pagination?: unknown };
  if (!Array.isArray(leadsJson.leads)) throw new Error("GET /api/leads response missing leads array");
  steps.push(`GET /api/leads OK (${leadsJson.leads.length} rows, paginated)`);

  console.log("Smoke demo passed:\n", steps.map((s) => `  • ${s}`).join("\n"));
}

main().catch((err) => {
  console.error("Smoke demo failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
