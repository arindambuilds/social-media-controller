import fs from "node:fs/promises";
import path from "node:path";
import type { QuadraState } from "../types/pipeline";
import { QUADRAPILOT_ROOT } from "./paths";

const STATE_FILE = path.join(QUADRAPILOT_ROOT, "state.json");

const DEFAULT_STATE: QuadraState = {
  cycleNumber: 0,
  lastRun: "",
  lastStatus: "IDLE",
  lastGoal: "",
  totalCyclesRun: 0,
  totalTestsPassed: 0
};

export async function readState(): Promise<QuadraState> {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<QuadraState>;
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export async function writeState(state: QuadraState): Promise<void> {
  await fs.mkdir(QUADRAPILOT_ROOT, { recursive: true });
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

export function statePath(): string {
  return STATE_FILE;
}
