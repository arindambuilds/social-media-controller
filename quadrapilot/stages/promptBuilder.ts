import fs from "node:fs/promises";
import path from "node:path";
import type { PipelineConfig, StageResult } from "../types/pipeline";
import { QUADRAPILOT_ROOT } from "../lib/paths";
import { copyToClipboard } from "../lib/clipboard";
import { openInVsCode } from "../lib/openInEditor";

function inject(
  tpl: string,
  vars: Record<string, string>
): string {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(v);
  }
  return out;
}

export async function runPromptBuilder(
  config: PipelineConfig,
  researchMarkdown: string
): Promise<StageResult> {
  const t0 = Date.now();
  const ts = new Date().toISOString();
  const tplPath = path.join(QUADRAPILOT_ROOT, "templates", "antigravityPrompt.txt");
  const tpl = await fs.readFile(tplPath, "utf8");
  const locked =
    config.lockedFiles.length > 0
      ? config.lockedFiles.map((f) => `- \`${f}\``).join("\n")
      : "_None specified — still avoid unrelated files._";

  const body = inject(tpl, {
    GOAL: config.goal,
    CYCLE_NUMBER: String(config.cycleNumber),
    RESEARCH: researchMarkdown.trim() || "_No research body._",
    PROJECT_CONTEXT: config.projectContext,
    LOCKED_FILES: locked,
    TEST_COMMAND: config.testCommand,
    LINT_COMMAND: config.lintCommand,
    CURRENT_TESTS: config.currentTestsHint
  });

  const outPath = path.join(config.outputDir, `cycle-${config.cycleNumber}-prompt.md`);
  await fs.mkdir(config.outputDir, { recursive: true });
  await fs.writeFile(outPath, body, "utf8");

  copyToClipboard(body);
  await openInVsCode([outPath]);

  return {
    stage: "Prompt builder",
    success: true,
    output: outPath,
    duration: Date.now() - t0,
    timestamp: ts
  };
}
