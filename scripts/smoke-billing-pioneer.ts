/**
 * Optional: verify Pioneer checkout against a running API (test-mode Stripe keys on the server).
 *
 *   npx tsx scripts/smoke-billing-pioneer.ts --url https://your-api.example.com
 *
 * Expects STRIPE_SECRET_KEY + STRIPE_PRICE_PIONEER600_INR on the API host.
 * Uses demo@demo.com / Demo1234! (AGENCY_ADMIN). Prints checkout URL or error.
 */

import { parseArgs } from "node:util";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: { url: { type: "string", default: "http://localhost:4000" }, base: { type: "string" } },
  strict: false
});

const BASE = ((values.base ?? values.url) ?? "http://localhost:4000").replace(/\/$/, "");

async function main(): Promise<void> {
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "demo@demo.com", password: "Demo1234!" })
  });
  const auth = (await login.json().catch(() => ({}))) as { accessToken?: string; user?: { role?: string } };
  if (!login.ok || !auth.accessToken) {
    console.error("Login failed — need demo user and AGENCY_ADMIN for /billing/checkout");
    process.exit(1);
  }
  if (auth.user?.role !== "AGENCY_ADMIN") {
    console.error("demo@demo.com must be AGENCY_ADMIN for this smoke (got role:", auth.user?.role, ")");
    process.exit(1);
  }

  const res = await fetch(`${BASE}/api/billing/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.accessToken}`
    },
    body: JSON.stringify({ planId: "pioneer" })
  });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok) {
    console.error("POST /api/billing/checkout", res.status, data.error ?? data);
    process.exit(1);
  }
  if (!data.url) {
    console.error("No checkout url in response", data);
    process.exit(1);
  }
  console.log("OK — checkout session created (Pioneer / STRIPE_PRICE_PIONEER600_INR).");
  console.log("URL:", data.url);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
