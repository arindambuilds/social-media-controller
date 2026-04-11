import { validateEnv } from "./lib/validateEnv";

validateEnv();

void import("./serverRuntime").catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Server bootstrap failed: ${message}`);
  process.exit(1);
});
