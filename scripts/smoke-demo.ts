/**
 * API smoke test. Requires: API + DB seeded. Logs in with primary operator demo@demo.com / Demo1234!.
 *
 * Usage:
 *   npm run smoke:local
 *   npm run smoke:render
 *   npx tsx scripts/smoke-demo.ts --url https://your-api.example.com
 */

import { parseArgs } from "node:util";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: { url: { type: "string", default: "http://localhost:4000" } },
  strict: false
});

async function main() {
  const BASE = (values.url ?? "http://localhost:4000").replace(/\/$/, "");
  const results: { name: string; passed: boolean; duration: number; error?: string }[] = [];

  async function check(name: string, fn: () => Promise<void>) {
    const start = Date.now();
    try {
      await fn();
      results.push({ name, passed: true, duration: Date.now() - start });
    } catch (err) {
      results.push({ name, passed: false, duration: Date.now() - start, error: String(err) });
    }
  }

  let token = "";
  let clientId = "";

  await check("Health", async () => {
    const r = await fetch(`${BASE}/api/health`);
    const d = (await r.json().catch(() => ({}))) as { status?: string };
    if (!r.ok || d.status !== "ok") throw new Error(`status=${d.status ?? r.status}`);
  });

  await check("Login", async () => {
    const r = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "demo@demo.com", password: "Demo1234!" })
    });
    const d = (await r.json().catch(() => ({}))) as {
      accessToken?: string;
      user?: { clientId?: string | null };
    };
    if (!r.ok || !d.accessToken) throw new Error("No accessToken in response");
    token = d.accessToken;
    clientId = d.user?.clientId ?? "";
  });

  await check("Analytics", async () => {
    if (!clientId) throw new Error("No clientId from login");
    const r = await fetch(`${BASE}/api/analytics/INSTAGRAM/${encodeURIComponent(clientId)}/summary`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const d = (await r.json().catch(() => ({}))) as { postsAnalyzed?: unknown };
    if (!r.ok || typeof d.postsAnalyzed !== "number") throw new Error("No postsAnalyzed number");
  });

  await check("AI Insights", async () => {
    if (!clientId) throw new Error("No clientId from login");
    const r = await fetch(`${BASE}/api/ai/insights/content-performance/${encodeURIComponent(clientId)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ platform: "INSTAGRAM" })
    });
    const d = (await r.json().catch(() => ({}))) as { summary?: unknown };
    if (!r.ok || typeof d.summary !== "string" || !d.summary.trim()) throw new Error("No summary in response");
  });

  await check("Leads", async () => {
    const r = await fetch(`${BASE}/api/leads?clientId=${encodeURIComponent(clientId)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const d = (await r.json().catch(() => ({}))) as { leads?: unknown };
    if (!r.ok || !Array.isArray(d.leads)) throw new Error("leads is not an array");
  });

  await check("Posts", async () => {
    if (!clientId) throw new Error("No clientId from login");
    const r = await fetch(`${BASE}/api/posts?clientId=${encodeURIComponent(clientId)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const d = (await r.json().catch(() => ({}))) as { posts?: unknown };
    if (!r.ok || !Array.isArray(d.posts)) throw new Error("posts is not an array");
  });

  console.log("\n┌─────────────────────┬────────┬──────────┐");
  console.log("│ Check               │ Status │ Duration │");
  console.log("├─────────────────────┼────────┼──────────┤");
  for (const row of results) {
    const name = row.name.padEnd(19);
    const status = row.passed ? "  ✅   " : "  ❌   ";
    const duration = `${row.duration}ms`.padStart(6);
    console.log(`│ ${name} │${status}│ ${duration}   │`);
    if (!row.passed && row.error) {
      const errLine = `  ↳ ${row.error.slice(0, 60)}`;
      console.log(`│ ${errLine.padEnd(60)} │`);
    }
  }
  console.log("└─────────────────────┴────────┴──────────┘");
  const passed = results.filter((r) => r.passed).length;
  console.log(`\nOverall: ${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
