import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import * as Sentry from "@sentry/node";
import { ZodError } from "zod";
import { env } from "../config/env";
import { logger } from "../lib/logger";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isProd = env.NODE_ENV === "production";

  if (err instanceof ZodError) {
    logger.warn("Validation error", { issues: err.issues });
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", fieldErrors: err.flatten().fieldErrors }
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    logger.error("Prisma error", { code: err.code, meta: err.meta, message: err.message });
    if (env.SENTRY_DSN) Sentry.captureException(err);
    res.status(400).json({
      success: false,
      error: {
        code: "BAD_REQUEST",
        message: isProd ? "Request could not be completed." : err.message
      }
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    logger.error("Prisma validation error", { message: err.message });
    if (env.SENTRY_DSN) Sentry.captureException(err);
    res.status(400).json({
      success: false,
      error: { code: "BAD_REQUEST", message: isProd ? "Invalid request." : err.message }
    });
    return;
  }

  if (err instanceof Error) {
    logger.error("Unhandled request error", { message: err.message, stack: err.stack });
    if (env.SENTRY_DSN) Sentry.captureException(err);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: isProd ? "Internal server error." : err.message
      }
    });
    return;
  }

  logger.error("Unknown error", { detail: String(err) });
  if (env.SENTRY_DSN) Sentry.captureException(err);
  res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message: "Internal server error." }
  });
}
