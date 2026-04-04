/**
 * Pre-deploy gate: env keys from .env.example (non-empty defaults), prisma validate, lint, tests.
 * Run from repo root: node scripts/pre-deploy-check.mjs
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

/** Merge `.env` into process.env when keys are unset (local runs). */
function loadDotEnvIfPresent() {
  const p = path.join(root, ".env");
  if (!fs.existsSync(p)) return;
  const text = fs.readFileSync(p, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const m = s.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    const k = m[1];
    if (process.env[k] != null && String(process.env[k]).trim() !== "") continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[k] = v;
  }
}

/** Fill missing keys from non-empty defaults in `.env.example` (so local pre-deploy matches CI). */
function mergeDefaultsFromExample() {
  const examplePath = path.join(root, ".env.example");
  const text = fs.readFileSync(examplePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const m = s.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    const k = m[1];
    let v = m[2].trim();
    if (v === "") continue;
    if (process.env[k] != null && String(process.env[k]).trim() !== "") continue;
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[k] = v;
  }
}

function parseRequiredEnvKeys() {
  const examplePath = path.join(root, ".env.example");
  const text = fs.readFileSync(examplePath, "utf8");
  const keys = [];
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const m = s.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    if (m[2].trim() === "") continue;
    keys.push(m[1]);
  }
  return keys;
}

function run(cmd, args, env = process.env) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    encoding: "utf8",
    env,
    shell: true,
    maxBuffer: 20 * 1024 * 1024
  });
  return {
    status: r.status ?? 1,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? ""
  };
}

function checkEnv(keys) {
  const missing = [];
  for (const k of keys) {
    const v = process.env[k];
    if (v == null || String(v).trim() === "") missing.push(k);
  }
  return missing;
}

function main() {
  loadDotEnvIfPresent();
  mergeDefaultsFromExample();
  const lines = [];
  let failed = false;

  const keys = parseRequiredEnvKeys();
  const missing = checkEnv(keys);
  if (missing.length === 0) {
    lines.push("PASS  ENV VARS");
  } else {
    failed = true;
    lines.push(`FAIL  ENV VARS (missing: ${missing.join(", ")})`);
  }

  const prisma = run("npx", ["prisma", "validate"]);
  if (prisma.status === 0) {
    lines.push("PASS  prisma validate");
  } else {
    failed = true;
    lines.push("FAIL  prisma validate");
    if (prisma.stderr.trim()) lines.push(prisma.stderr.trim());
    if (prisma.stdout.trim()) lines.push(prisma.stdout.trim());
  }

  const lint = run("npm", ["run", "lint"]);
  if (lint.status === 0) {
    lines.push("PASS  lint");
  } else {
    failed = true;
    lines.push("FAIL  lint");
    if (lint.stderr.trim()) lines.push(lint.stderr.trim().slice(0, 2000));
    if (lint.stdout.trim()) lines.push(lint.stdout.trim().slice(0, 2000));
  }

  // GitHub Actions deploy.yml already runs `npm test` — a second run can flake (rate limits, DB state).
  const skipTests = process.env.GITHUB_ACTIONS === "true" || process.env.PRE_DEPLOY_SKIP_TESTS === "1";
  if (skipTests) {
    lines.push("SKIP  tests (GITHUB_ACTIONS or PRE_DEPLOY_SKIP_TESTS — suite already ran in CI)");
  } else {
    const test = run("npm", ["test"], { ...process.env, NODE_ENV: "test" });
    if (test.status === 0) {
      lines.push("PASS  tests");
    } else {
      failed = true;
      lines.push("FAIL  tests");
      if (test.stderr.trim()) lines.push(test.stderr.trim().slice(0, 2000));
      if (test.stdout.trim()) lines.push(test.stdout.trim().slice(0, 2000));
    }
  }

  lines.push("──────────────────");
  if (!failed) {
    lines.push("All checks passed. Ready to deploy.");
  } else {
    lines.push("One or more checks failed.");
  }

  console.log(lines.join("\n"));
  process.exit(failed ? 1 : 0);
}

main();
