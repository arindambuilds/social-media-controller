import { execFile as execFileCb } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const STATE_PATH = path.join(REPO_ROOT, "quadrapilot", "state.json");
const OUTPUT_DIR = path.join(REPO_ROOT, "quadrapilot", "output");

export type OrchestratorResult = {
  output: string;
  metadata: {
    stages: string[];
    timing: { totalMs: number; perStageMs: Record<string, number> };
    errors: string[];
  };
};

type QuadraState = { cycleNumber?: number };

async function readCycleNumber(): Promise<number> {
  try {
    const raw = await fs.readFile(STATE_PATH, "utf8");
    const parsed = JSON.parse(raw) as QuadraState;
    return Number(parsed.cycleNumber ?? 0);
  } catch {
    return 0;
  }
}

async function readReport(cycleNumber: number): Promise<string> {
  const reportPath = path.join(OUTPUT_DIR, `cycle-${cycleNumber}-report.md`);
  return fs.readFile(reportPath, "utf8");
}

function parseStageRows(reportMarkdown: string): { perStageMs: Record<string, number>; errors: string[] } {
  const perStageMs: Record<string, number> = {};
  const errors: string[] = [];
  const lines = reportMarkdown.split(/\r?\n/);

  for (const line of lines) {
    const match = /^\|\s(.+?)\s\|\s(\d+)ms\s\|\s(.+?)\s\|$/.exec(line.trim());
    if (!match) continue;
    const stage = match[1]!;
    const ms = Number(match[2]!);
    const status = match[3]!;
    perStageMs[stage] = ms;
    if (status.includes("❌")) {
      errors.push(`${stage}: failed`);
    }
  }

  return { perStageMs, errors };
}

export async function runOrchestrator(input: string): Promise<OrchestratorResult> {
  const beforeCycle = await readCycleNumber();
  const child = await execFile(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["tsx", "quadrapilot/run.ts", input],
    {
      cwd: REPO_ROOT,
      timeout: 12 * 60 * 1000,
      maxBuffer: 1024 * 1024 * 10
    }
  ).catch((err: unknown) => {
    const e = err as { stderr?: string; message?: string };
    throw new Error(e.stderr?.trim() || e.message || "Quadrapilot execution failed");
  });

  const afterCycle = await readCycleNumber();
  if (afterCycle <= beforeCycle) {
    throw new Error("Quadrapilot did not produce a new cycle");
  }

  const report = await readReport(afterCycle);
  const { perStageMs, errors } = parseStageRows(report);
  const stages = Object.keys(perStageMs);
  const totalMs = Object.values(perStageMs).reduce((sum, ms) => sum + ms, 0);

  const output =
    report
      .split(/\r?\n/)
      .find((line) => line.startsWith("Cycle ") && line.includes("status")) ??
    (child.stdout?.trim() || `Quadrapilot completed cycle ${afterCycle}`);

  return {
    output,
    metadata: {
      stages,
      timing: {
        totalMs,
        perStageMs
      },
      errors
    }
  };
}

