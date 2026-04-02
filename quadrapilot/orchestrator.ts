import fs from "node:fs/promises";
import path from "node:path";
import type {
  PerplexityQuestion,
  PipelineConfig,
  PipelineResult,
  SmokeGateStatus,
  StageResult
} from "./types/pipeline";
import { readState, writeState } from "./lib/state";
import type { QuadraState } from "./types/pipeline";
import { loadPipelineConfig } from "./lib/config";
import { runClaudeStage } from "./stages/claudeStage";
import { runPerplexityStage } from "./stages/perplexityStage";
import { runPromptBuilder } from "./stages/promptBuilder";
import { runTestRunner } from "./stages/testRunner";
import { runReportGenerator } from "./stages/reportGenerator";
import { openInVsCode } from "./lib/openInEditor";

function smokeGateFromTestJson(tj: unknown): SmokeGateStatus {
  const o = tj as { smokeGate?: string; smokePassed?: boolean };
  if (o.smokeGate === "PASSED" || o.smokeGate === "FAILED" || o.smokeGate === "SKIPPED") {
    return o.smokeGate;
  }
  if (o.smokePassed === true) return "PASSED";
  return "FAILED";
}

async function runStage(
  name: string,
  fn: () => Promise<StageResult>
): Promise<StageResult> {
  const stageStart = Date.now();
  console.log(`⏳ ${name}…`);
  try {
    const result = await fn();
    result.duration = Date.now() - stageStart;
    if (result.success) {
      console.log(`✅ ${result.stage} — ${result.duration}ms`);
    } else {
      console.log(`⚠️  ${result.stage} — needs review (${result.error ?? "no error code"})`);
    }
    return result;
  } catch (error) {
    console.log(`❌ ${name} — FAILED`);
    return {
      stage: name,
      success: false,
      output: "",
      duration: Date.now() - stageStart,
      timestamp: new Date().toISOString(),
      error: String(error)
    };
  }
}

export async function runFullPipeline(goal: string): Promise<PipelineResult> {
  const startTime = Date.now();
  const state = await readState();
  const cycleNumber = state.cycleNumber + 1;
  const config = loadPipelineConfig(goal, cycleNumber);

  const results: StageResult[] = [];

  const claude = await runStage("Claude (research questions)", () => runClaudeStage(config));
  results.push(claude);

  let questions: PerplexityQuestion[] = [];
  try {
    const raw = await fs.readFile(claude.output, "utf8");
    questions = JSON.parse(raw) as PerplexityQuestion[];
  } catch {
    questions = [];
  }

  const perplexity = await runStage("Perplexity", () => runPerplexityStage(config, questions));
  results.push(perplexity);

  let researchMd = "";
  try {
    researchMd = await fs.readFile(perplexity.output, "utf8");
  } catch {
    researchMd = "";
  }

  const prompt = await runStage("Prompt builder", () => runPromptBuilder(config, researchMd));
  results.push(prompt);

  const tests = await runStage("Test runner", () => runTestRunner(config));
  results.push(tests);

  let testCount = "?/?";
  let testsPassed = false;
  let lintClean = false;
  let smokeGate: SmokeGateStatus = "FAILED";
  try {
    const raw = await fs.readFile(tests.output, "utf8");
    const tj = JSON.parse(raw) as {
      testCount: string;
      testsPassed: boolean;
      lintClean: boolean;
    };
    testCount = tj.testCount;
    testsPassed = tj.testsPassed;
    lintClean = tj.lintClean;
    smokeGate = smokeGateFromTestJson(tj);
  } catch {
    /* keep defaults */
  }

  const allStageSuccess = results.every((r) => r.success);
  const status: PipelineResult["status"] = allStageSuccess ? "SUCCESS" : "NEEDS_REVIEW";

  const nextActions: string[] = [];
  if (!testsPassed || !lintClean) {
    nextActions.push("Fix failing tests or lint, then run: npm run quadra:test");
  }
  if (smokeGate === "FAILED") {
    nextActions.push("SMOKE_GATE: FAILED — fix `npm run smoke:render` before marking the cycle successful.");
  }
  if (smokeGate === "SKIPPED") {
    nextActions.push(
      "Smoke was skipped (SMOKE_ENV=skip). Run `npm run smoke:render` — target: Smoke test: 7/7 checks (Health, Login, Analytics, AI Insights, Leads, Gov preview, Posts)."
    );
  }
  if (!perplexity.success) {
    nextActions.push("Review Perplexity errors; re-run cycle with PERPLEXITY_API_KEY if missing.");
  }
  nextActions.push(`Open and paste: ${prompt.output}`);
  nextActions.push("After Antigravity commits: npm run quadra:verify (or quadra:test)");

  const pipelineResult: PipelineResult = {
    cycleNumber,
    goal,
    stages: results,
    testsPassed,
    testCount,
    lintClean,
    smokeGate,
    totalDuration: Date.now() - startTime,
    reportPath: path.join(config.outputDir, `cycle-${cycleNumber}-report.md`),
    antigravityPromptPath: prompt.output,
    status,
    nextActions
  };

  const report = await runStage("Report generator", () =>
    runReportGenerator(config, pipelineResult)
  );
  results.push(report);
  pipelineResult.stages = results;
  pipelineResult.reportPath = report.output;
  pipelineResult.totalDuration = Date.now() - startTime;
  await runReportGenerator(config, pipelineResult);

  const passedMatch = testCount.match(/^(\d+)\//);
  const passedN = passedMatch ? parseInt(passedMatch[1]!, 10) : 0;

  const newState: QuadraState = {
    cycleNumber,
    lastRun: new Date().toISOString(),
    lastStatus: status,
    lastGoal: goal,
    totalCyclesRun: state.totalCyclesRun + 1,
    totalTestsPassed:
      testsPassed && passedN > 0 ? Math.max(state.totalTestsPassed, passedN) : state.totalTestsPassed
  };
  await writeState(newState);

  console.log(`
╔══════════════════════════════════════╗
║  CYCLE ${cycleNumber} COMPLETE              ║
║                                      ║
║  Status: ${status.padEnd(27)}║
║  Duration: ${String(Math.round(pipelineResult.totalDuration / 1000) + "s").padEnd(24)}║
║  Report: cycle-${cycleNumber}-report.md${" ".repeat(Math.max(0, 14 - String(cycleNumber).length))}║
╚══════════════════════════════════════╝

NEXT ACTION:
1. Review: ${prompt.output}
   (prompt copied to clipboard)
2. Paste into Antigravity
3. After Antigravity commits — run:
   npm run quadra:verify
`);

  if (smokeGate === "FAILED") {
    console.log("\nCycle complete — SMOKE FAILED. Review needed.\n");
  }

  await openInVsCode([report.output, prompt.output]);

  return pipelineResult;
}

export async function runTestsOnly(): Promise<void> {
  const state = await readState();
  const cycle = Math.max(1, state.cycleNumber);
  const config = loadPipelineConfig(state.lastGoal || "verify", cycle);
  await runStage("Test runner", () => runTestRunner(config));
}

export async function runVerify(): Promise<void> {
  console.log("⏳ QuadraPilot verify (tests + lint only)…");
  await runTestsOnly();
}

export async function printStatus(): Promise<void> {
  const s = await readState();
  console.log(JSON.stringify(s, null, 2));
}

export async function runReportOnly(): Promise<void> {
  const state = await readState();
  const cycle = Math.max(1, state.cycleNumber);
  const goal = state.lastGoal || "(no goal in state)";
  const config = loadPipelineConfig(goal, cycle);

  let testsPassed = true;
  let testCount = "?/?";
  let lintClean = true;
  let smokeGate: SmokeGateStatus = "FAILED";
  const testsPath = path.join(config.outputDir, `cycle-${cycle}-tests.json`);
  try {
    const raw = await fs.readFile(testsPath, "utf8");
    const tj = JSON.parse(raw) as {
      testCount: string;
      testsPassed: boolean;
      lintClean: boolean;
    };
    testCount = tj.testCount;
    testsPassed = tj.testsPassed;
    lintClean = tj.lintClean;
    smokeGate = smokeGateFromTestJson(tj);
  } catch {
    testsPassed = false;
    lintClean = false;
    smokeGate = "FAILED";
  }

  const stages: StageResult[] = [
    {
      stage: "Report-only (reconstructed)",
      success: true,
      output: "",
      duration: 0,
      timestamp: new Date().toISOString()
    }
  ];

  const status: PipelineResult["status"] =
    testsPassed && lintClean && smokeGate === "PASSED" ? "SUCCESS" : "NEEDS_REVIEW";

  const result: PipelineResult = {
    cycleNumber: cycle,
    goal,
    stages,
    testsPassed,
    testCount,
    lintClean,
    smokeGate,
    totalDuration: 0,
    reportPath: path.join(config.outputDir, `cycle-${cycle}-report.md`),
    antigravityPromptPath: path.join(config.outputDir, `cycle-${cycle}-prompt.md`),
    status,
    nextActions: ["Re-run full cycle for fresh research: npm run quadra -- \"…goal…\""]
  };

  await runReportGenerator(config, result);
  console.log(`✅ Report regenerated: ${result.reportPath}`);
}
