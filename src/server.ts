import * as Sentry from "@sentry/node";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { createApp } from "./app";

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: 0.2
  });
}

const app = createApp();

const PORT = Number(process.env.PORT) || 4000;

app.listen(PORT, "0.0.0.0", () => {
  logger.info("API server started", {
    port: PORT,
    environment: env.NODE_ENV
  });
});
