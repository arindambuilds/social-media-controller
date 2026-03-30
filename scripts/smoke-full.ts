type Result = { name: string; pass: boolean; detail: string };

const BASE = (process.env.API_URL ?? "http://localhost:4000/api").replace(/\/$/, "");
const TEST_EMAIL = process.env.TEST_EMAIL ?? "demo@demo.com";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "Demo1234!";

const results: Result[] = [];

async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, pass: true, detail: "OK" });
    console.log(`  ✅ ${name}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ name, pass: false, detail: msg });
    console.log(`  ❌ ${name}: ${msg}`);
  }
}

async function get(path: string, token?: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on GET ${path}`);
  return res.json();
}

async function post(path: string, body: unknown, token?: string) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on POST ${path}`);
  return res.json();
}

async function run() {
  console.log("\n🔍 PULSE — Full QA Smoke Test\n");
  console.log("━".repeat(50));

  let token = "";

  console.log("\n📋 AUTH\n");
  await check("POST /auth/login — valid credentials", async () => {
    const d = await post("/auth/login", { email: TEST_EMAIL, password: TEST_PASSWORD });
    if (!d.accessToken) throw new Error("No accessToken in response");
    token = d.accessToken as string;
  });

  await check("GET /auth/me — returns user object", async () => {
    const d = await get("/auth/me", token);
    if (!d?.user?.id) throw new Error("No user id in response");
  });

  await check("GET /auth/me — no token returns 401", async () => {
    const res = await fetch(`${BASE}/auth/me`);
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  await check("POST /auth/login — wrong password returns 401", async () => {
    const res = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: TEST_EMAIL, password: "wrongpass123" })
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  console.log("\n📋 USAGE & BILLING\n");
  await check("GET /agency/usage — returns plan + usage", async () => {
    const d = await get("/agency/usage", token);
    if (!d.plan) throw new Error("Missing plan");
    if (!d.usage) throw new Error("Missing usage");
  });

  await check("POST /billing/checkout missing priceId -> 400/500 safe", async () => {
    const res = await fetch(`${BASE}/billing/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({})
    });
    if (![400, 500, 503].includes(res.status)) {
      throw new Error(`Expected safe error status, got ${res.status}`);
    }
  });

  console.log("\n📋 ANALYTICS\n");
  await check("GET /analytics/demo-client/overview — returns object", async () => {
    const d = await get("/analytics/demo-client/overview?days=30", token);
    if (typeof d !== "object" || d == null) throw new Error("Overview is not an object");
  });

  await check("GET /analytics/demo-client/insights/hourly — returns array", async () => {
    const d = await get("/analytics/demo-client/insights/hourly", token);
    if (!Array.isArray(d.hours)) throw new Error("hours is not an array");
  });

  await check("GET /posts?clientId=demo-client — returns posts array", async () => {
    const d = await get("/posts?clientId=demo-client&limit=5&sort=engagement", token);
    if (!Array.isArray(d.posts)) throw new Error("posts is not an array");
  });

  console.log("\n📋 BRIEFINGS\n");
  await check("GET /briefing/latest with clientId — returns data or safe access denial", async () => {
    const res = await fetch(`${BASE}/briefing/latest?clientId=demo-client`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.status === 403) return;
    if (!res.ok) throw new Error(`HTTP ${res.status} on GET /briefing/latest?clientId=demo-client`);
    const d = await res.json();
    if (!("briefing" in d)) throw new Error("Missing briefing key");
  });

  console.log("\n📋 SYSTEM HEALTH\n");
  await check("GET /health — returns 200", async () => {
    const res = await fetch(`${BASE.replace(/\/api$/, "")}/health`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  await check("GET /api/health?deps=1 — returns checks/components", async () => {
    const d = await fetch(`${BASE}/health?deps=1`).then((r) => r.json());
    if (!(d.components || d.checks || d.status)) throw new Error("Missing dependency health shape");
  });

  console.log("\n" + "━".repeat(50));
  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;
  console.log(`\n📊 Results: ${passed}/${results.length} passed, ${failed} failed\n`);

  if (failed > 0) {
    console.log("❌ FAILING TESTS:\n");
    for (const r of results.filter((x) => !x.pass)) {
      console.log(`  • ${r.name}`);
      console.log(`    ${r.detail}\n`);
    }
    process.exit(1);
  }

  console.log("✅ ALL TESTS PASSED — app is demo-ready\n");
}

void run();
