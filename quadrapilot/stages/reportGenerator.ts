import fs from "node:fs/promises";
import path from "node:path";
import type { PipelineConfig, PipelineResult, StageResult } from "../types/pipeline";
import { REPO_ROOT } from "../lib/paths";

function inject(tpl: string, vars: Record<string, string>): string {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(v);
  }
  return out;
}

function stageRows(stages: StageResult[]): string {
  return stages
    .map(
      (s) =>
        `| ${s.stage} | ${s.duration}ms | ${s.success ? "✅" : s.error ? "❌" : "⚠️"} |`
    )
    .join("\n");
}

function executiveSummary(result: PipelineResult): string {
  const status = result.status;
  const testLine =
    result.testsPassed && result.lintClean
      ? `Tests ${result.testCount} and lint are clean.`
      : `Tests/lint need attention (${result.testCount}, lint ${result.lintClean ? "ok" : "errors"}).`;
  const smokeLine =
    result.smokeGate === "PASSED"
      ? "SMOKE_GATE: PASSED (6/6)."
      : result.smokeGate === "SKIPPED"
        ? "SMOKE_GATE: SKIPPED (offline only — not valid for delivery sign-off)."
        : "SMOKE_GATE: FAILED — review `npm run smoke:render`.";
  return `Cycle ${result.cycleNumber} completed with status **${status}**. ${testLine} ${smokeLine} Goal: ${result.goal.slice(0, 120)}${result.goal.length > 120 ? "…" : ""}`;
}

export async function runReportGenerator(
  config: PipelineConfig,
  result: PipelineResult
): Promise<StageResult> {
  const t0 = Date.now();
  const ts = new Date().toISOString();
  const tplPath = path.join(REPO_ROOT, "quadrapilot", "templates", "progressReport.md");
  const tpl = await fs.readFile(tplPath, "utf8");

  const researchSummary = result.stages
    .filter((s) => s.stage.includes("Perplexity"))
    .map((s) => `- ${s.stage}: ${s.success ? "completed" : "needs review"} → \`${s.output}\``)
    .join("\n");

  const risks =
    result.status === "NEEDS_REVIEW"
      ? "- Pipeline finished with failing tests or lint, or partial Perplexity failures.\n- Review `cycle-*-tests.json` and CI output before merging."
      : result.status === "FAILED"
        ? "- One or more stages threw or hard-failed. Check console and stage errors."
        : "- None flagged automatically.";

  const nextActions =
    result.nextActions.length > 0
      ? result.nextActions.map((a) => `- ${a}`).join("\n")
      : "- Paste `cycle-*-prompt.md` into Antigravity.\n- After implementation run `npm run quadra:test`.\n- Commit with `cycle(N): …` format.";

  const date = new Date().toISOString().slice(0, 10);
  const lintStatus = result.lintClean ? "Clean" : "Errors";
  const durationSec = (result.totalDuration / 1000).toFixed(1);

  const smokeGateLabel =
    result.smokeGate === "PASSED"
      ? "SMOKE_GATE: PASSED"
      : result.smokeGate === "SKIPPED"
        ? "SMOKE_GATE: SKIPPED"
        : "SMOKE_GATE: FAILED";

  const md = inject(tpl, {
    CYCLE_NUMBER: String(result.cycleNumber),
    DATE: date,
    EXECUTIVE_SUMMARY: executiveSummary(result),
    GOAL: result.goal,
    RESEARCH_SUMMARY: researchSummary || "_See research markdown in output._",
    IMPLEMENTATION_STATUS: `_Antigravity / Cursor work tracked outside this file. Goal:_ ${result.goal}`,
    TEST_COUNT: result.testCount,
    LINT_STATUS: lintStatus,
    SMOKE_GATE: smokeGateLabel,
    DURATION_SEC: durationSec,
    RISKS: risks,
    NEXT_ACTIONS: nextActions,
    STAGE_ROWS: stageRows(result.stages),
    TOTAL_MS: String(result.totalDuration),
    PIPELINE_STATUS: result.status
  });

  const outPath = path.join(config.outputDir, `cycle-${result.cycleNumber}-report.md`);
  await fs.mkdir(config.outputDir, { recursive: true });
  await fs.writeFile(outPath, md, "utf8");

  const docsDir = path.join(REPO_ROOT, "docs", "progress");
  await fs.mkdir(docsDir, { recursive: true });
  const docsPath = path.join(docsDir, `cycle-${result.cycleNumber}-report.md`);
  await fs.writeFile(docsPath, md, "utf8");

  return {
    stage: "Report generator",
    success: true,
    output: outPath,
    duration: Date.now() - t0,
    timestamp: ts
  };
}
