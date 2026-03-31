import path from "node:path";
import type { PipelineConfig } from "../types/pipeline";
import { REPO_ROOT } from "./paths";

function splitLocked(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function loadPipelineConfig(goal: string, cycleNumber: number): PipelineConfig {
  const outputDir = process.env.QUADRAPILOT_OUTPUT_DIR?.trim() || "quadrapilot/output";
  const perplexityApiKey = process.env.PERPLEXITY_API_KEY?.trim() || "";
  const claudeApiKey =
    process.env.ANTHROPIC_API_KEY?.trim() ||
    process.env.CLAUDE_API_KEY?.trim() ||
    process.env.QUADRAPILOT_CLAUDE_API_KEY?.trim() ||
    "";

  const projectName = process.env.QUADRAPILOT_PROJECT_NAME?.trim() || "PulseOS";
  const stack =
    process.env.QUADRAPILOT_STACK?.trim() ||
    "Node.js/TypeScript/BullMQ/Prisma/Supabase/Express/Next.js";
  const lockedFiles = splitLocked(process.env.QUADRAPILOT_LOCKED_FILES);

  const projectContext = [
    `${projectName} — AI social copilot for Indian MSMEs (Instagram growth, analytics, PDF exports, briefings).`,
    `Stack: ${stack}.`,
    "Production targets: reliability, auditability, government-pilot readiness."
  ].join(" ");

  return {
    cycleNumber,
    goal,
    projectContext,
    lockedFiles,
    testCommand: "npm test",
    lintCommand: "npm run lint",
    perplexityApiKey,
    claudeApiKey,
    outputDir: path.isAbsolute(outputDir) ? outputDir : path.join(REPO_ROOT, outputDir),
    projectName,
    repoRoot: REPO_ROOT,
    claudeModel:
      process.env.QUADRAPILOT_CLAUDE_MODEL?.trim() || "claude-sonnet-4-20250514",
    currentTestsHint:
      process.env.QUADRAPILOT_CURRENT_TESTS?.trim() || "51/51 in 10 files (Cycle 6 baseline; C1 live E2E pending operator)"
  };
}
