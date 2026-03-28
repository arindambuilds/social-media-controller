#!/usr/bin/env node
/**
 * Production smoke: health, DB probe, login.
 *
 * Usage:
 *   SMOKE_API_BASE=https://your-api.onrender.com node scripts/smoke-test.js
 *   # or
 *   NEXT_PUBLIC_API_URL=https://your-api.onrender.com node scripts/smoke-test.js
 *
 * DATABASE_URL is not required for this script (HTTP-only). CI: exit 1 on any failure.
 */

const base = (
  process.env.SMOKE_API_BASE ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_URL ||
  "https://social-media-controller.onrender.com"
)
  .replace(/\/$/, "")
  .replace(/\/api$/i, "");

let failed = false;

function logPass(step, detail) {
  console.log(`PASS  ${step}${detail ? ` — ${detail}` : ""}`);
}

function logFail(step, detail) {
  failed = true;
  console.error(`FAIL  ${step}${detail ? ` — ${detail}` : ""}`);
}

async function request(method, path, { jsonBody } = {}) {
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const init = {
    method,
    headers: jsonBody ? { "Content-Type": "application/json" } : {}
  };
  if (jsonBody) init.body = JSON.stringify(jsonBody);
  const res = await fetch(url, init);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { _raw: text };
  }
  return { res, body, text };
}

async function main() {
  console.log(`Smoke API base: ${base}\n`);

  // 1) GET /api/health
  try {
    const { res, body } = await request("GET", "/api/health");
    if (res.status !== 200) {
      logFail("GET /api/health", `status ${res.status} ${JSON.stringify(body)}`);
    } else {
      logPass("GET /api/health", `status ${res.status}`);
    }
  } catch (e) {
    logFail("GET /api/health", String(e));
  }

  // 2) GET /api/health/db
  try {
    const { res, body } = await request("GET", "/api/health/db");
    if (res.status !== 200) {
      logFail("GET /api/health/db", `status ${res.status} ${JSON.stringify(body)}`);
    } else if (body.status !== "ok") {
      logFail("GET /api/health/db", `body.status=${JSON.stringify(body.status)}`);
    } else {
      logPass("GET /api/health/db", `status ${res.status} status=ok`);
    }
  } catch (e) {
    logFail("GET /api/health/db", String(e));
  }

  // 3) POST /api/auth/login
  try {
    const { res, body } = await request("POST", "/api/auth/login", {
      jsonBody: { email: "demo@demo.com", password: "Demo1234!" }
    });
    if (res.status !== 200) {
      logFail("POST /api/auth/login", `status ${res.status} ${JSON.stringify(body)}`);
    } else if (!body.accessToken) {
      logFail("POST /api/auth/login", "missing accessToken in body");
    } else {
      logPass("POST /api/auth/login", `status ${res.status} accessToken present`);
    }
  } catch (e) {
    logFail("POST /api/auth/login", String(e));
  }

  if (failed) {
    console.error("\nSmoke test finished with failures.");
    process.exit(1);
  }
  console.log("\nAll smoke steps passed.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
