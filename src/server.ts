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

const port = Number(process.env.PORT) || 4000;

app.listen(port, () => {
  logger.info("API server started", {
    port,
    environment: env.NODE_ENV
  });
});
