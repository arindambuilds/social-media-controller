import { execFile as execFileCb } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { logger } from "../lib/logger";
import { dispatchEmailFromAgent } from "./emailDispatcher";
import { extractEmailFromText, resolveRecipient } from "./recipientResolver";
import type { EmailAction, OrchestrationResult } from "./types";

const execFile = promisify(execFileCb);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const STATE_PATH = path.join(REPO_ROOT, "quadrapilot", "state.json");
const OUTPUT_DIR = path.join(REPO_ROOT, "quadrapilot", "output");

type QuadraState = { cycleNumber?: number };
type OrchestratorUserContext = {
  id?: string;
  email?: string;
};

type RunOrchestratorOptions = {
  user?: OrchestratorUserContext;
  requestedRecipient?: string;
  emailAction?: EmailAction;
};

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

function normalizeEmailAction(action: EmailAction, resultText: string, options: RunOrchestratorOptions): EmailAction | null {
  const requestedTo = Array.isArray(action.to) ? action.to : action.to ? [action.to] : [];
  if (requestedTo.length === 0 || requestedTo.includes("auto")) {
    const recipient = resolveRecipient({
      userEmail: options.user?.email,
      requestProvided: options.requestedRecipient,
      contextExtracted: extractEmailFromText(resultText) || undefined,
      fallback: process.env.DEFAULT_ALERT_EMAIL || undefined
    });
    if (!recipient) return null;
    return {
      ...action,
      to: Array.isArray(action.to) ? [recipient] : recipient
    };
  }
  if (action.type === "notification" && !action.data.body.trim()) {
    return {
      ...action,
      data: {
        ...action.data,
        body: resultText
      }
    };
  }
  return action;
}

export async function runOrchestrator(
  input: string,
  _context?: Record<string, unknown>,
  options: RunOrchestratorOptions = {}
): Promise<OrchestrationResult> {
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

  const emailAction = options.emailAction
    ? normalizeEmailAction(options.emailAction, output, options) ?? undefined
    : undefined;
  if (emailAction?.enabled) {
    void dispatchEmailFromAgent(emailAction).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("[quadrapilot] agent email dispatch failed", { message });
    });
  }

  return {
    finalReply: output,
    stages,
    metadata: {
      stages,
      timing: {
        totalMs,
        perStageMs
      },
      errors
    },
    emailAction
  };
}
