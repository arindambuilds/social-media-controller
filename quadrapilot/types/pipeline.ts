export interface PipelineConfig {
  cycleNumber: number;
  goal: string;
  projectContext: string;
  lockedFiles: string[];
  testCommand: string;
  lintCommand: string;
  perplexityApiKey: string;
  claudeApiKey: string;
  outputDir: string;
  projectName: string;
  repoRoot: string;
  claudeModel: string;
  currentTestsHint: string;
}

export interface StageResult {
  stage: string;
  success: boolean;
  output: string;
  duration: number;
  timestamp: string;
  error?: string;
}

export type SmokeGateStatus = "PASSED" | "FAILED" | "SKIPPED";

export interface PipelineResult {
  cycleNumber: number;
  goal: string;
  stages: StageResult[];
  testsPassed: boolean;
  testCount: string;
  lintClean: boolean;
  /**
   * Remote smoke: PASSED (7/7 — Health, Login, Analytics, AI Insights, Leads, Gov preview, Posts), FAILED, or SKIPPED when `SMOKE_ENV=skip`.
   * Delivery reports must use PASSED only after a real remote run.
   */
  smokeGate: SmokeGateStatus;
  totalDuration: number;
  reportPath: string;
  antigravityPromptPath: string;
  status: "SUCCESS" | "NEEDS_REVIEW" | "FAILED";
  nextActions: string[];
}

export interface PerplexityQuestion {
  id: number;
  question: string;
  versionPin: string;
  context: string;
}

export interface PerplexityAnswer {
  questionId: number;
  pattern: string;
  snippet: string;
  gotcha: string;
  sources: string[];
}

export interface TestRunRecord {
  testsPassed: boolean;
  testCount: string;
  lintClean: boolean;
  /** Remote smoke outcome, or SKIPPED when `SMOKE_ENV=skip`. */
  smokeGate: SmokeGateStatus;
  prismaGenerateOk: boolean;
  tscOk: boolean;
  testOutput: string;
  lintOutput: string;
  smokeOutput: string;
  duration: number;
  timestamp: string;
}

export interface QuadraState {
  cycleNumber: number;
  lastRun: string;
  lastStatus: "SUCCESS" | "NEEDS_REVIEW" | "FAILED" | "IDLE";
  lastGoal: string;
  totalCyclesRun: number;
  /** Best-known passing test count from last green run (informational). */
  totalTestsPassed: number;
}
