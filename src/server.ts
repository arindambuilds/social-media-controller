import { env } from "./config/env";
import { logger } from "./lib/logger";
import { createApp } from "./app";

const app = createApp();

app.listen(env.PORT, () => {
  logger.info("API server started", {
    port: env.PORT,
    environment: env.NODE_ENV
  });
});
