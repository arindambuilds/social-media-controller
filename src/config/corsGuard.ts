/**
 * Runs before `env` parsing so `NODE_ENV=production` + `CORS_ORIGIN=*` fails fast with a clear message.
 * Imported first from `app.ts`.
 *
 * **Startup order (API process):** `server.ts` imports `createApp` from `./app` before `./config/env`, so
 * `app.ts` loads first and this module runs before `env.ts` Zod validation. If anything imports `./config/env`
 * alone (scripts/tests), only Zod applies — wildcard CORS in production still fails there.
 */
if (process.env.NODE_ENV === "production" && (process.env.CORS_ORIGIN ?? "").trim() === "*") {
  throw new Error(
    '[SECURITY] CORS_ORIGIN is set to "*" in production. ' +
      "Set it to your exact frontend origin (e.g. https://app.pulseos.io)."
  );
}
