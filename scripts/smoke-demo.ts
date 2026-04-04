/**
 * Post-deploy API smoke test. Resolves base URL from env/flags, waits for cold start,
 * then checks public (and optional authenticated) endpoints.
 *
 * Base URL (first match): CLI `--base` / `--url`, then `RENDER_URL`, `API_URL`,
 * `SMOKE_BASE_URL`, `SMOKE_URL`, else `https://social-media-controller.onrender.com`.
 *
 * Optional auth: set `SMOKE_EMAIL` + `SMOKE_PASSWORD` (e.g. GitHub Actions secrets) for
 * login + `GET /api/notifications`. If unset, only public checks run.
 *
 * Usage:
 *   npm run smoke:local
 *   npm run smoke:render
 *   npm run smoke:render -- --base https://your-api.example.com
 *   RENDER_URL=https://... npx tsx scripts/smoke-demo.ts
 */

import { parseArgs } from "node:util";

const DEFAULT_PUBLIC_API = "https://social-media-controller.onrender.com";
const READY_POLL_MS = 5000;
const READY_MAX_ATTEMPTS = 24;

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    base: { type: "string" },
    url: { type: "string" }
  },
  strict: false
});

function resolveBaseUrl(): string {
  const fromFlag = (values.base ?? values.url)?.trim();
  const fromEnv =
    process.env.RENDER_URL?.trim() ||
    process.env.API_URL?.trim() ||
    process.env.SMOKE_BASE_URL?.trim() ||
    process.env.SMOKE_URL?.trim();
  return (fromFlag || fromEnv || DEFAULT_PUBLIC_API).replace(/\/$/, "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Poll until GET /api/health returns 200 with a known health payload (handles Render cold start). */
async function waitForServerReady(base: string): Promise<void> {
  for (let attempt = 1; attempt <= READY_MAX_ATTEMPTS; attempt++) {
    try {
      const r = await fetch(`${base}/api/health`);
      if (r.status === 200) {
        const d = (await r.json().catch(() => ({}))) as { status?: string };
        if (d.status === "ok" || d.status === "degraded") {
          if (attempt > 1) {
            console.log(`[smoke] Server ready after ${attempt} attempt(s).`);
          }
          return;
        }
      }
    } catch {
      // cold start / DNS / connection errors — retry
    }
    if (attempt < READY_MAX_ATTEMPTS) {
      console.log(
        `[smoke] Waiting for /api/health (attempt ${attempt}/${READY_MAX_ATTEMPTS}, next in ${READY_POLL_MS / 1000}s)…`
      );
      await sleep(READY_POLL_MS);
    }
  }
  console.error("ERROR: Server did not become ready within 120s");
  process.exit(1);
}

type Row = { name: string; passed: boolean; duration: number; error?: string };

async function main() {
  const base = resolveBaseUrl();
  const smokeEmail = process.env.SMOKE_EMAIL?.trim();
  const smokePassword = process.env.SMOKE_PASSWORD?.trim();
  const hasAuthCreds = Boolean(smokeEmail && smokePassword);

  const results: Row[] = [];

  async function check(name: string, fn: () => Promise<void>) {
    const start = Date.now();
    try {
      await fn();
      results.push({ name, passed: true, duration: Date.now() - start });
    } catch (err) {
      results.push({ name, passed: false, duration: Date.now() - start, error: String(err) });
    }
  }

  console.log(`[smoke] Target: ${base}`);
  await waitForServerReady(base);

  await check("GET /api/health", async () => {
    const r = await fetch(`${base}/api/health`);
    const d = (await r.json().catch(() => ({}))) as { status?: string };
    if (!r.ok || (d.status !== "ok" && d.status !== "degraded")) {
      throw new Error(`expected 200 + status ok|degraded, got ${r.status} ${JSON.stringify(d)}`);
    }
  });

  await check("GET /api/", async () => {
    const r = await fetch(`${base}/api/`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  });

  let token = "";
  if (hasAuthCreds) {
    await check("POST /api/auth/login", async () => {
      const r = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: smokeEmail, password: smokePassword })
      });
      const d = (await r.json().catch(() => ({}))) as { accessToken?: string };
      if (!r.ok || !d.accessToken) {
        throw new Error(!r.ok ? `HTTP ${r.status}` : "No accessToken in response");
      }
      token = d.accessToken;
    });

    await check("GET /api/notifications", async () => {
      const r = await fetch(`${base}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const d = (await r.json().catch(() => ({}))) as { success?: boolean };
      if (!r.ok || d.success !== true) {
        throw new Error(`expected 200 + success: true, got ${r.status} ${JSON.stringify(d)}`);
      }
    });
  } else {
    console.log("[smoke] SMOKE_EMAIL/SMOKE_PASSWORD not set — skipping authenticated checks.");
  }

  for (const row of results) {
    const label = row.passed ? "PASS" : "FAIL";
    console.log(`${label} ${row.name} (${row.duration}ms)`);
    if (!row.passed && row.error) {
      console.log(`  ↳ ${row.error}`);
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const allOk = passed === total;

  console.log("");
  if (allOk) {
    console.log(`✓ ${passed}/${total} smoke checks passed`);
    console.log(`Ready: ${base}`);
  } else {
    console.log(`✗ ${passed}/${total} smoke checks passed`);
  }

  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
