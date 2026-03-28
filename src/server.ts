import http from "http";
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
const PORT = parseInt(process.env.PORT || "8080", 10);

const httpServer = http.createServer(app);

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  logger.info("API server started", {
    port: PORT,
    environment: env.NODE_ENV
  });
});
