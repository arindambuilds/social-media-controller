import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { createOptionalRedisRateLimitStore } from "./rateLimitStore";

/** Standard JSON body for rate limit responses — never echo internal errors. */
function sendLimit(
  res: import("express").Response,
  windowMs: number,
  body: Record<string, unknown>
): void {
  res.setHeader("Retry-After", String(Math.ceil(windowMs / 1000)));
  res.status(429).json(body);
}

/** Global API budget — slows volumetric probes while allowing normal use. */
export const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: createOptionalRedisRateLimitStore("rl:global:"),
  passOnStoreError: true,
  skip: (req) => {
    const p = req.path || "";
    if (p === "/health" || p.startsWith("/api/health")) return true;
    if (p === "/api/metrics") return true;
    if (p.startsWith("/api/webhooks")) return true;
    if (p === "/api/events" || p.startsWith("/api/events")) return true;
    return false;
  },
  handler: (_req, res, _next, options) => {
    sendLimit(res, options.windowMs, {
      success: false,
      error: {
        code: "RATE_LIMIT",
        message: "You have sent too many requests. Please wait a few minutes and try again."
      }
    });
  }
});

/** Slows password-guessing on login without impacting other routes. */
export const loginAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: createOptionalRedisRateLimitStore("rl:auth:"),
  passOnStoreError: true,
  handler: (_req, res, _next, options) => {
    sendLimit(res, options.windowMs, {
      success: false,
      error: { code: "RATE_LIMIT", message: "Too many login attempts. Try again later." }
    });
  }
});

/** Caps refresh-token abuse and accidental retry storms (multiple tabs still fit). */
export const refreshAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  store: createOptionalRedisRateLimitStore("rl:refresh:"),
  passOnStoreError: true,
  handler: (_req, res, _next, options) => {
    sendLimit(res, options.windowMs, {
      success: false,
      error: { code: "RATE_LIMIT", message: "Too many refresh attempts. Try again later." }
    });
  }
});

/** DM reply preview — Claude cost control per client. */
export const dmPreviewLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: createOptionalRedisRateLimitStore("rl:dm_preview:"),
  passOnStoreError: true,
  keyGenerator: (req) => {
    const auth = req.auth;
    const body = (req.body ?? {}) as { clientId?: string };
    const cid = typeof body.clientId === "string" ? body.clientId : "none";
    const actor = auth?.userId ?? `ip:${ipKeyGenerator(req.ip ?? "")}`;
    return `${actor}:${cid}`;
  },
  handler: (_req, res, _next, options) => {
    sendLimit(res, options.windowMs, {
      success: false,
      error: {
        code: "RATE_LIMIT",
        message: "Too many preview requests. Wait a minute and try again."
      }
    });
  }
});

/** Limits account-creation abuse (register + public signup share the same bucket). */
/** PDF export storm control — per authenticated user (falls back to IP if auth missing). */
export const reportPdfExportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: createOptionalRedisRateLimitStore("rl:report_pdf:"),
  passOnStoreError: true,
  keyGenerator: (req) => {
    const auth = (req as { auth?: { userId?: string } }).auth;
    const uid = auth?.userId;
    if (uid) return `report_pdf:${uid}`;
    return `report_pdf:ip:${ipKeyGenerator(req.ip ?? "")}`;
  },
  handler: (_req, res, _next, options) => {
    sendLimit(res, options.windowMs, {
      success: false,
      error: {
        code: "PDF_RATE_LIMIT",
        message: "Too many PDF exports. Wait a minute and try again."
      }
    });
  }
});

export const registerAuthLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  store: createOptionalRedisRateLimitStore("rl:register:"),
  passOnStoreError: true,
  handler: (_req, res, _next, options) => {
    sendLimit(res, options.windowMs, {
      success: false,
      error: { code: "RATE_LIMIT", message: "Too many registration attempts. Try again later." }
    });
  }
});

/** High-throughput webhook endpoint (Meta retries on non-200). */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  store: createOptionalRedisRateLimitStore("rl:webhook:"),
  passOnStoreError: true,
  handler: (_req, res, _next, options) => {
    sendLimit(res, options.windowMs, { error: "Too many webhook requests" });
  }
});
