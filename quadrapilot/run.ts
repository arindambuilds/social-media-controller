#!/usr/bin/env npx tsx
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { REPO_ROOT } from "./lib/paths";
import { runFullPipeline, runReportOnly, runVerify, printStatus } from "./orchestrator";

const argv = process.argv.slice(2);
const cmd = argv[0]?.toLowerCase();

async function main(): Promise<void> {
  loadEnv({ path: path.join(REPO_ROOT, ".env") });
  if (!cmd || cmd === "help" || cmd === "-h") {
    console.log(`
QuadraPilot — Quadra automation (Claude → Perplexity → Antigravity prompt → tests → report)

  npx tsx quadrapilot/run.ts "<goal>"   New cycle (increment cycle number)
  npm run quadra -- "<goal>"

  npm run quadra:test    Tests + lint only (uses last cycle id in state)
  npm run quadra:verify  Same as quadra:test
  npm run quadra:report  Regenerate report from last artifacts
  npm run quadra:status  Print state.json
`);
    process.exit(0);
    return;
  }

  if (cmd === "test" || cmd === "verify") {
    await runVerify();
    return;
  }

  if (cmd === "report") {
    await runReportOnly();
    return;
  }

  if (cmd === "status") {
    await printStatus();
    return;
  }

  const goal = argv.join(" ").trim();
  if (!goal) {
    console.error("❌ Pass a goal string, e.g. npx tsx quadrapilot/run.ts \"Add Odia briefing\"");
    process.exit(1);
    return;
  }

  await runFullPipeline(goal);
}

main().catch((e) => {
  console.error("❌ QuadraPilot fatal:", e);
  process.exit(1);
});
