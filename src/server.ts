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

app.listen(env.PORT, () => {
  logger.info("API server started", {
    port: env.PORT,
    environment: env.NODE_ENV
  });
});
