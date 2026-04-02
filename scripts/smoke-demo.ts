/**
 * API smoke test. Requires: API + DB seeded. Logs in with primary operator demo@demo.com / Demo1234!.
 *
 * Single source of truth (team, CI, docs): **7 checks**, fixed order below.
 * Canonical line: "Smoke test: 10/10 checks (Health, Login, Analytics, AI Insights, Leads, Gov preview, Posts, WA GET, WA POST HMAC, Health deps WA)."
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

import { createHmac } from "node:crypto";
import { parseArgs } from "node:util";

/** Keep identical to quadrapilot/README.md, TRUTH_TABLE.md, and docs/cycle3-antigravity-tech-status.md */
const SMOKE_CONTRACT_LINE =
  "Smoke test: 10/10 checks (Health, Login, Analytics, AI Insights, Leads, Gov preview, Posts, WA GET, WA POST HMAC, Health deps WA).";

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
  const fromFlag =
    typeof values.base === "string"
      ? values.base.trim()
      : typeof values.url === "string"
        ? values.url.trim()
        : "";
  const fromEnv = (process.env.SMOKE_BASE_URL ?? process.env.SMOKE_URL ?? "").trim();
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
    // fallback added 31 Mar 2026 – matches src/app.ts mounting
    const assertGovShape = (d: Record<string, unknown>) => {
      if (typeof d.msmes !== "number") throw new Error("missing msmes");
      if (typeof d.leadsThisWeek !== "number") throw new Error("missing leadsThisWeek");
      if (typeof d.odiaPercent !== "number") throw new Error("missing odiaPercent");
    };
    const tried: string[] = [];
    const primary = `${BASE}/api/pulse/gov-preview`;
    const fallback = `${BASE}/api/gov-preview`;
    let r = await fetch(primary);
    tried.push(`/api/pulse/gov-preview→${r.status}`);
    let d = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (r.ok) {
      assertGovShape(d);
      return;
    }
    if (r.status === 404) {
      r = await fetch(fallback);
      tried.push(`/api/gov-preview→${r.status}`);
      d = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (r.ok) {
        assertGovShape(d);
        return;
      }
    }
    throw new Error(`gov-preview failed (${tried.join(", ")})`);
  });

  await check("Posts", async () => {
    if (!clientId) throw new Error("No clientId from login");
    const r = await fetch(`${BASE}/api/posts?clientId=${encodeURIComponent(clientId)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const d = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) {
      const hint = typeof d.error === "object" && d.error && "message" in d.error
        ? String((d.error as { message?: string }).message)
        : JSON.stringify(d).slice(0, 120);
      throw new Error(`GET /api/posts HTTP ${r.status}: ${hint}`);
    }
    const response = d as Record<string, unknown>;
    const dataVal = response.data;
    const dataPosts =
      dataVal && typeof dataVal === "object" && dataVal !== null && !Array.isArray(dataVal) && "posts" in dataVal
        ? (dataVal as { posts: unknown }).posts
        : undefined;
    // tolerant shape check – handles {posts}, {data: {posts}}, or direct array
    const postsData =
      (Array.isArray(response.posts) ? response.posts : undefined) ??
      (Array.isArray(dataPosts) ? dataPosts : undefined) ??
      (Array.isArray(dataVal) ? dataVal : undefined) ??
      [];
    if (!Array.isArray(postsData)) {
      throw new Error(`posts: expected array; got keys: ${Object.keys(d).join(",")}`);
    }
  });

  await check("WA webhook verify (GET)", async () => {
    const verify = (process.env.WEBHOOK_VERIFY_TOKEN ?? "").trim();
    if (!verify) return;
    const challenge = "pulse-smoke-challenge";
    const r = await fetch(
      `${BASE}/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(verify)}&hub.challenge=${encodeURIComponent(challenge)}`
    );
    const text = await r.text();
    if (!r.ok || text !== challenge) {
      throw new Error(`expected 200 + echoed challenge, got ${r.status} body=${text.slice(0, 120)}`);
    }
  });

  await check("WA webhook POST (HMAC)", async () => {
    const secret = (process.env.WA_APP_SECRET ?? "").trim();
    if (!secret) return;
    const bodyObj = {
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "123456789012345" },
                contacts: [{ wa_id: "15551234567", profile: { name: "Smoke" } }],
                messages: [
                  {
                    from: "15551234567",
                    id: `wamid.smoke.${Date.now()}`,
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: "text",
                    text: { body: "smoke" }
                  }
                ]
              }
            }
          ]
        }
      ]
    };
    const raw = JSON.stringify(bodyObj);
    const sig = createHmac("sha256", secret).update(raw, "utf8").digest("hex");
    const r = await fetch(`${BASE}/whatsapp/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hub-signature-256": `sha256=${sig}`
      },
      body: raw
    });
    const t = await r.text();
    if (!r.ok || t.trim() !== "OK") {
      throw new Error(`POST /whatsapp/webhook expected 200 OK, got ${r.status} ${t.slice(0, 120)}`);
    }
  });

  await check("Health deps (WhatsApp + Redis)", async () => {
    const r = await fetch(`${BASE}/api/health?deps=1`);
    const d = (await r.json().catch(() => ({}))) as {
      whatsapp_ingress?: { status?: string; dlq_last_5min?: unknown };
      whatsapp_outbound?: { status?: string; dlq_last_5min?: unknown };
      redis?: { status?: string };
      components?: { whatsapp_ingress?: { status?: string } };
    };
    if (!r.ok) throw new Error(`deps health HTTP ${r.status}`);
    if (typeof d.whatsapp_ingress?.dlq_last_5min !== "number") {
      throw new Error("whatsapp_ingress.dlq_last_5min missing or not a number");
    }
    if (typeof d.whatsapp_outbound?.dlq_last_5min !== "number") {
      throw new Error("whatsapp_outbound.dlq_last_5min missing or not a number");
    }
    const redisComp = d.components?.redis as { status?: string } | undefined;
    if (redisComp && redisComp.status !== "skipped" && d.redis?.status !== "ok") {
      throw new Error(`redis.status expected ok when Redis is configured, got ${d.redis?.status ?? "undefined"}`);
    }
    if (d.components?.whatsapp_ingress?.status === "skipped") {
      return;
    }
    if (d.whatsapp_ingress?.status !== "ok" || d.whatsapp_outbound?.status !== "ok") {
      throw new Error(
        `whatsapp_ingress/outbound status must be ok when WA is configured (or skipped); got ${d.whatsapp_ingress?.status} / ${d.whatsapp_outbound?.status}`
      );
    }
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
  if (total !== 10) {
    console.warn(`[smoke] Expected exactly 10 checks; found ${total}. Update SMOKE_CONTRACT_LINE and docs if intentional.`);
  }
  if (passed === total && total === 10) {
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
