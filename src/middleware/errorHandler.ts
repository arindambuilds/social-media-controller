import type { NextFunction, Request, Response } from "express";
import { Prisma } from '@prisma/client';
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
        message: isProd ? "Something went wrong. Please try again." : err.message
      }
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    logger.error("Prisma validation error", { message: err.message });
    if (env.SENTRY_DSN) Sentry.captureException(err);
    res.status(400).json({
      success: false,
      error: { code: "BAD_REQUEST", message: isProd ? "Something went wrong. Please try again." : err.message }
    });
    return;
  }

  const parseMeta = err as { type?: string; status?: number };
  if (parseMeta.type === "entity.parse.failed") {
    logger.warn("Invalid JSON request body", {
      message: err instanceof Error ? err.message : String(err)
    });
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_JSON",
        message: "Request body must be valid JSON (double-quoted keys and strings)."
      }
    });
    return;
  }

  if (err instanceof SyntaxError && /json|JSON/i.test(err.message)) {
    logger.warn("JSON parse error on request body", { message: err.message });
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_JSON",
        message: "Request body must be valid JSON (double-quoted keys and strings)."
      }
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
        message: isProd ? "Something went wrong. Please try again." : err.message
      }
    });
    return;
  }

  logger.error("Unknown error", { detail: String(err) });
  if (env.SENTRY_DSN) Sentry.captureException(err);
  res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." }
  });
}