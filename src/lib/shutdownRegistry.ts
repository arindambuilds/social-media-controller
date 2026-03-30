import { logger } from "./logger";

const hooks: Array<() => Promise<void>> = [];
let installed = false;

export function registerShutdownHook(fn: () => Promise<void>): void {
  hooks.push(fn);
}

export async function runShutdownHooks(): Promise<void> {
  for (const fn of hooks) {
    try {
      await fn();
    } catch (e) {
      logger.warn("shutdown_hook_failed", { message: e instanceof Error ? e.message : String(e) });
    }
  }
}

/**
 * SIGTERM/SIGINT: drain hooks then exit. Call once from `server.ts` / worker entrypoints.
 */
export function installProcessShutdownHandlers(onShutdown: () => Promise<void>): void {
  if (installed) return;
  installed = true;

  const run = (): void => {
    void (async () => {
      try {
        await onShutdown();
      } finally {
        process.exit(0);
      }
    })();
  };

  process.on("SIGTERM", run);
  process.on("SIGINT", run);
}
