/**
 * API smoke test. Requires: API + DB seeded (demo@demo.com / Demo1234!).
 *
 * Usage:
 *   npx tsx scripts/smoke-demo.ts
 *   npx tsx scripts/smoke-demo.ts --url https://social-media-controller.onrender.com
 *   SMOKE_BASE_URL=http://localhost:4000 npx tsx scripts/smoke-demo.ts
 */

type Row = { name: string; ok: boolean; detail: string };

function parseArgs(): { base: string; email: string; password: string; clientId: string } {
  const args = process.argv.slice(2);
  let base = process.env.SMOKE_BASE_URL ?? "http://localhost:4000";
  let email = process.env.SMOKE_EMAIL ?? "demo@demo.com";
  let password = process.env.SMOKE_PASSWORD ?? "Demo1234!";
  let clientId = process.env.SMOKE_CLIENT_ID ?? "demo-client";
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--url" && args[i + 1]) {
      base = args[i + 1]!;
      i += 1;
    }
  }
  base = base.replace(/\/$/, "");
  return { base, email, password, clientId };
}

async function main() {
  const { base, email, password, clientId } = parseArgs();
  const rows: Row[] = [];

  const push = (name: string, ok: boolean, detail: string) => rows.push({ name, ok, detail });

  try {
    const health = await fetch(`${base}/api/health`);
    const healthJson = (await health.json().catch(() => ({}))) as { status?: string };
    push(
      "GET /api/health",
      health.ok && healthJson.status === "ok",
      health.ok ? JSON.stringify(healthJson) : `${health.status}`
    );
  } catch (e) {
    push("GET /api/health", false, e instanceof Error ? e.message : String(e));
  }

  let token = "";
  try {
    const loginRes = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const loginText = await loginRes.text();
    const loginJson = JSON.parse(loginText) as { accessToken?: string; success?: boolean };
    token = loginJson.accessToken ?? "";
    push(
      "POST /api/auth/login",
      loginRes.ok && !!token,
      loginRes.ok ? "token received" : `${loginRes.status} ${loginText.slice(0, 200)}`
    );
  } catch (e) {
    push("POST /api/auth/login", false, e instanceof Error ? e.message : String(e));
  }

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };

  if (token) {
    try {
      const summaryRes = await fetch(
        `${base}/api/analytics/INSTAGRAM/${encodeURIComponent(clientId)}/summary`,
        { headers: authHeaders }
      );
      const summaryJson = (await summaryRes.json().catch(() => ({}))) as {
        postsAnalyzed?: number;
      };
      push(
        "GET /api/analytics/INSTAGRAM/:clientId/summary",
        summaryRes.ok && (summaryJson.postsAnalyzed ?? 0) > 0,
        summaryRes.ok
          ? `postsAnalyzed=${summaryJson.postsAnalyzed ?? 0}`
          : `${summaryRes.status}`
      );
    } catch (e) {
      push(
        "GET /api/analytics/INSTAGRAM/:clientId/summary",
        false,
        e instanceof Error ? e.message : String(e)
      );
    }

    try {
      const insightRes = await fetch(
        `${base}/api/ai/insights/content-performance/${encodeURIComponent(clientId)}`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ platform: "INSTAGRAM" })
        }
      );
      const insightJson = (await insightRes.json().catch(() => ({}))) as { summary?: string };
      const hasSummary =
        typeof insightJson.summary === "string" && insightJson.summary.trim().length > 0;
      push(
        "POST /api/ai/insights/content-performance/:clientId",
        insightRes.ok && hasSummary,
        insightRes.ok ? `summary len=${insightJson.summary?.length ?? 0}` : `${insightRes.status}`
      );
    } catch (e) {
      push(
        "POST /api/ai/insights/content-performance/:clientId",
        false,
        e instanceof Error ? e.message : String(e)
      );
    }

    try {
      const leadsRes = await fetch(`${base}/api/leads?clientId=${encodeURIComponent(clientId)}`, {
        headers: authHeaders
      });
      const leadsJson = (await leadsRes.json().catch(() => ({}))) as { leads?: unknown[] };
      const n = Array.isArray(leadsJson.leads) ? leadsJson.leads.length : 0;
      push("GET /api/leads", leadsRes.ok && n > 0, leadsRes.ok ? `${n} leads` : `${leadsRes.status}`);
    } catch (e) {
      push("GET /api/leads", false, e instanceof Error ? e.message : String(e));
    }

    try {
      const postsRes = await fetch(
        `${base}/api/analytics/${encodeURIComponent(clientId)}/posts?limit=20&sort=engagement`,
        { headers: authHeaders }
      );
      const postsJson = (await postsRes.json().catch(() => ({}))) as { posts?: unknown[] };
      const n = Array.isArray(postsJson.posts) ? postsJson.posts.length : 0;
      push(
        "GET /api/analytics/:clientId/posts",
        postsRes.ok && n > 0,
        postsRes.ok ? `${n} posts` : `${postsRes.status}`
      );
    } catch (e) {
      push("GET /api/analytics/:clientId/posts", false, e instanceof Error ? e.message : String(e));
    }
  } else {
    push("GET /api/analytics/INSTAGRAM/:clientId/summary", false, "skipped (no token)");
    push("POST /api/ai/insights/content-performance/:clientId", false, "skipped (no token)");
    push("GET /api/leads", false, "skipped (no token)");
    push("GET /api/analytics/:clientId/posts", false, "skipped (no token)");
  }

  console.log("\nSmoke demo results\n");
  console.log("| Step | Pass | Detail |");
  console.log("|------|------|--------|");
  for (const r of rows) {
    console.log(`| ${r.name} | ${r.ok ? "PASS" : "FAIL"} | ${r.detail.replace(/\|/g, "/")} |`);
  }
  const failed = rows.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error(`\n${failed.length} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll checks passed.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
