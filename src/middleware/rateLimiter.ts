import rateLimit from "express-rate-limit";

/** Standard JSON body for rate limit responses — never echo internal errors. */
function sendLimit(
  res: import("express").Response,
  windowMs: number,
  body: Record<string, unknown>
): void {
  // Retry-After helps clients back off without hammering auth endpoints.
  res.setHeader("Retry-After", String(Math.ceil(windowMs / 1000)));
  res.status(429).json(body);
}

/** Global API budget — slows volumetric probes while allowing normal use. */
export const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const p = req.path || "";
    if (p === "/health" || p.startsWith("/api/health")) return true;
    if (p.startsWith("/api/webhooks")) return true;
    return false;
  },
  handler: (_req, res, _next, options) => {
    sendLimit(res, options.windowMs, {
      success: false,
      error: { code: "RATE_LIMIT", message: "Too many requests. Please try again later." }
    });
  }
});

/** Slows password-guessing on login without impacting other routes. */
export const loginAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
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
  handler: (_req, res, _next, options) => {
    sendLimit(res, options.windowMs, {
      success: false,
      error: { code: "RATE_LIMIT", message: "Too many refresh attempts. Try again later." }
    });
  }
});

/** Limits account-creation abuse (register + public signup share the same bucket). */
export const registerAuthLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res, _next, options) => {
    sendLimit(res, options.windowMs, {
      success: false,
      error: { code: "RATE_LIMIT", message: "Too many registration attempts. Try again later." }
    });
  }
});
