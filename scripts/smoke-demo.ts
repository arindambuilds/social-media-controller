/**
 * API smoke test. Requires: API + DB seeded. Logs in with primary operator demo@demo.com / Demo1234!.
 *
 * Single source of truth (team, CI, docs): **7 checks**, fixed order below.
 * Canonical line: "Smoke test: 7/7 checks (Health, Login, Analytics, AI Insights, Leads, Gov preview, Posts)."
 *
 * Usage:
 *   npm run smoke:local
 *   npm run smoke:render
 *   npm run smoke:render -- --base https://your-api.example.com   # overrides baked-in --url
 *   npx tsx scripts/smoke-demo.ts --url https://your-api.example.com
 *   SMOKE_BASE_URL=https://... npx tsx scripts/smoke-demo.ts
 *
 * Always pass the **API** origin (e.g. Render `https://…onrender.com`), not the Vercel dashboard URL.
 */

import { parseArgs } from "node:util";

/** Keep identical to quadrapilot/README.md, TRUTH_TABLE.md, and docs/cycle3-antigravity-tech-status.md */
const SMOKE_CONTRACT_LINE =
  "Smoke test: 7/7 checks (Health, Login, Analytics, AI Insights, Leads, Gov preview, Posts).";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    /** API origin only (alias of --url); wins over --url when both are passed (e.g. after npm run smoke:render --). */
    base: { type: "string" },
    url: { type: "string" }
  },
  strict: false
});

function resolveBaseUrl(): string {
  const fromFlag = (values.base ?? values.url)?.trim();
  const fromEnv = (process.env.SMOKE_BASE_URL ?? process.env.SMOKE_URL)?.trim();
  return (fromFlag || fromEnv || "http://localhost:4000").replace(/\/$/, "");
}

async function main() {
  const BASE = resolveBaseUrl();
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
    const body = JSON.stringify({ email: "demo@demo.com", password: "Demo1234!" });
    let lastErr = "No accessToken in response";
    for (let attempt = 0; attempt < 6; attempt++) {
      const r = await fetch(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body
      });
      const d = (await r.json().catch(() => ({}))) as {
        accessToken?: string;
        user?: { clientId?: string | null };
      };
      if (r.status === 429) {
        lastErr = "login rate limited (429) — wait or retry from another network";
        const waitMs = Math.min(30_000, 2000 * 2 ** attempt);
        await new Promise((res) => setTimeout(res, waitMs));
        continue;
      }
      if (r.ok && d.accessToken) {
        token = d.accessToken;
        clientId = d.user?.clientId ?? "";
        return;
      }
      lastErr = !r.ok ? `HTTP ${r.status}` : "No accessToken in response";
      break;
    }
    throw new Error(lastErr);
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
    const d = (await r.json().catch(() => ({}))) as Record<string, unknown> & {
      pagination?: { total?: unknown };
    };
    if (!r.ok || !Array.isArray(d.leads)) throw new Error("response.leads is not an array");
    const total =
      typeof d.total === "number"
        ? d.total
        : typeof d.pagination?.total === "number"
          ? d.pagination.total
          : undefined;
    if (total === undefined || !Number.isFinite(total)) {
      throw new Error("response.total is not a number (need top-level total or pagination.total)");
    }
  });

  await check("Gov preview", async () => {
    const paths = [`${BASE}/api/pulse/gov-preview`, `${BASE}/api/gov-preview`];
    let lastStatus = 0;
    for (const url of paths) {
      const r = await fetch(url);
      lastStatus = r.status;
      const d = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok) continue;
      if (typeof d.msmes !== "number") throw new Error("missing msmes");
      if (typeof d.leadsThisWeek !== "number") throw new Error("missing leadsThisWeek");
      if (typeof d.odiaPercent !== "number") throw new Error("missing odiaPercent");
      return;
    }
    throw new Error(`gov-preview status ${lastStatus} (tried /api/pulse/gov-preview and /api/gov-preview)`);
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
  const total = results.length;
  console.log(`\nOverall: ${passed}/${total} passed`);
  if (total !== 7) {
    console.warn(`[smoke] Expected exactly 7 checks; found ${total}. Update SMOKE_CONTRACT_LINE and docs if intentional.`);
  }
  if (passed === total && total === 7) {
    console.log(`✓ ${SMOKE_CONTRACT_LINE}`);
  } else {
    console.log(`Gate not met. When green: ${SMOKE_CONTRACT_LINE}`);
  }
  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
