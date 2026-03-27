import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { apiRouter } from "./routes";
import { logger } from "./lib/logger";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(
    morgan("combined", {
      stream: {
        write: (message) => logger.info(message.trim())
      }
    })
  );

  app.use("/api", apiRouter);

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error("Unhandled request error", { message: err.message, stack: err.stack });
    res.status(500).json({ error: "Internal server error." });
  });

  return app;
}
