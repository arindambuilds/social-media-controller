/**
 * Runs before `env` parsing so `NODE_ENV=production` + `CORS_ORIGIN=*` fails fast with a clear message.
 * Imported first from `app.ts`.
 */
if (process.env.NODE_ENV === "production" && (process.env.CORS_ORIGIN ?? "").trim() === "*") {
  throw new Error(
    '[SECURITY] CORS_ORIGIN is set to "*" in production. ' +
      "Set it to your exact frontend origin (e.g. https://app.pulseos.io)."
  );
}
