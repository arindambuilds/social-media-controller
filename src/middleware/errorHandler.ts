import type { NextFunction, Request, Response } from "express";
import * as Sentry from "@sentry/node";
import { env } from "../config/env";
import { logger } from "../lib/logger";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  logger.error("Unhandled request error", { message: err.message, stack: err.stack });
  if (env.SENTRY_DSN) {
    Sentry.captureException(err);
  }
  res.status(500).json({ error: "Internal server error." });
}
