import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import type { PipelineConfig, SmokeGateStatus, StageResult, TestRunRecord } from "../types/pipeline";

function runCmd(
  cmd: string,
  args: string[],
  cwd: string
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const chunksOut: Buffer[] = [];
    const chunksErr: Buffer[] = [];
    const child = spawn(cmd, args, {
      cwd,
      shell: process.platform === "win32",
      env: { ...process.env, CI: process.env.CI ?? "1" }
    });
    child.stdout?.on("data", (d) => chunksOut.push(Buffer.from(d)));
    child.stderr?.on("data", (d) => chunksErr.push(Buffer.from(d)));
    child.on("close", (code) => {
      resolve({
        code,
        stdout: Buffer.concat(chunksOut).toString("utf8"),
        stderr: Buffer.concat(chunksErr).toString("utf8")
      });
    });
    child.on("error", (err) => {
      resolve({
        code: 1,
        stdout: Buffer.concat(chunksOut).toString("utf8"),
        stderr: `${Buffer.concat(chunksErr).toString("utf8")}\n${err.message}`
      });
    });
  });
}

function parseTestCount(combined: string): string {
  const failPass = combined.match(
    /Tests\s+(\d+)\s+failed\s*\|\s*(\d+)\s+passed\s*\((\d+)\)/i
  );
  if (failPass) {
    const passed = failPass[2];
    const total = failPass[3];
    return `${passed}/${total}`;
  }
  const allPass = combined.match(/Tests\s+(\d+)\s+passed\s*\((\d+)\)/i);
  if (allPass) {
    const n = allPass[1];
    return `${n}/${allPass[2]}`;
  }
  const files = combined.match(/Test Files\s+(.+)/i);
  if (files) return files[1]!.trim().slice(0, 80);
  return "?/?";
}

function testsPassedFromOutput(combined: string, exitCode: number | null): boolean {
  if (exitCode !== 0) return false;
  if (/FAIL|failed\s+\(/i.test(combined) && /\d+\s+failed/i.test(combined)) return false;
  return true;
}

export async function runTestRunner(config: PipelineConfig): Promise<StageResult> {
  const t0 = Date.now();
  const ts = new Date().toISOString();
  const cwd = config.repoRoot;

  console.log("⏳ npx prisma generate…");
  const genProc = await runCmd("npx", ["prisma", "generate"], cwd);
  const genOk = genProc.code === 0;
  if (!genOk) {
    console.log(`❌ prisma generate failed (exit ${genProc.code})`);
  } else {
    console.log("✅ Prisma client generated.");
  }

  console.log("⏳ npx tsc --noEmit…");
  const tscProc = await runCmd("npx", ["tsc", "--noEmit"], cwd);
  const tscOk = tscProc.code === 0;
  if (!tscOk) {
    console.log(`❌ tsc reported errors (exit ${tscProc.code})`);
  } else {
    console.log("✅ Typecheck clean.");
  }

  console.log("⏳ npm run lint…");
  const lintProc = await runCmd("npm", ["run", "lint"], cwd);
  const lintOut = `${lintProc.stdout}\n${lintProc.stderr}`;
  const lintClean = lintProc.code === 0;

  if (!lintClean) {
    console.log("❌ Lint reported errors (non-zero exit).");
  } else {
    console.log("✅ Lint clean (exit 0).");
  }

  console.log("⏳ npm test…");
  const testProc = await runCmd("npm", ["test"], cwd);
  const testOut = `${testProc.stdout}\n${testProc.stderr}`;
  const testCount = parseTestCount(testOut);
  const testsOk = testsPassedFromOutput(testOut, testProc.code);

  if (!testsOk) {
    console.log(`❌ TESTS FAILING: ${testCount} (exit ${testProc.code})`);
  } else {
    console.log(`✅ Tests: ${testCount}`);
  }

  const smokeMode = (process.env.SMOKE_ENV ?? "remote").trim().toLowerCase();
  let smokeGate: SmokeGateStatus;
  let smokeOut: string;

  if (smokeMode === "skip") {
    console.log(
      "[Stage 4] Smoke skipped (SMOKE_ENV=skip). Set SMOKE_ENV=remote or unset to enforce Render smoke."
    );
    smokeGate = "SKIPPED";
    smokeOut = "[Stage 4] smoke:render not run (SMOKE_ENV=skip)\n";
  } else {
    console.log("⏳ npm run smoke:render…");
    const smokeProc = await runCmd("npm", ["run", "smoke:render"], cwd);
    smokeOut = `${smokeProc.stdout}\n${smokeProc.stderr}`;
    const remoteOk = smokeProc.code === 0 && /Overall:\s*6\/6\s+passed/i.test(smokeOut);
    smokeGate = remoteOk ? "PASSED" : "FAILED";
    if (!remoteOk) {
      console.log("❌ SMOKE_GATE: FAILED (npm run smoke:render)");
    } else {
      console.log("✅ Smoke: 6/6 passed");
    }
  }

  const duration = Date.now() - t0;
  const record: TestRunRecord = {
    prismaGenerateOk: genOk,
    tscOk,
    testsPassed: testsOk,
    testCount,
    lintClean,
    smokeGate,
    testOutput: testOut.slice(-120_000),
    lintOutput: lintOut.slice(-60_000),
    smokeOutput: smokeOut.slice(-60_000),
    duration,
    timestamp: ts
  };

  const jsonPath = path.join(config.outputDir, `cycle-${config.cycleNumber}-tests.json`);
  await fs.mkdir(config.outputDir, { recursive: true });
  await fs.writeFile(jsonPath, JSON.stringify(record, null, 2), "utf8");

  const smokeStageOk = smokeGate === "PASSED" || smokeGate === "SKIPPED";
  const success = genOk && tscOk && testsOk && lintClean && smokeStageOk;
  return {
    stage: "Test runner",
    success,
    output: jsonPath,
    duration,
    timestamp: ts,
    error: success ? undefined : "prisma_tsc_lint_tests_or_smoke_failed"
  };
}
