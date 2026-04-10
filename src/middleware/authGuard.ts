/**
 * Universal Authentication Guard
 * Blocks all API routes by default unless explicitly bypassed.
 * This ensures no endpoint is accidentally left unprotected.
 */

import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../auth/jwt";
import { env } from "../config/env";
import { ACCESS_COOKIE } from "../lib/authCookies";
import { logger } from "../lib/logger";

/**
 * Public routes that don't require authentication
 */
const PUBLIC_ROUTES = new Set([
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/refresh",
  "/api/auth/logout",
  "/api/health",
  "/api/health/db",
  "/api/health/degraded",
  "/api/health/critical",
  "/health",
  "/api/briefing/public",
  "/api/oauth/instagram/callback",
  "/api/billing/webhook", // Stripe webhook
  "/whatsapp/webhook", // WhatsApp webhook
  "/api/webhook/instagram" // Instagram webhook
]);

/**
 * Check if a route is public (doesn't require auth)
 */
function isPublicRoute(path: string): boolean {
  // Exact match
  if (PUBLIC_ROUTES.has(path)) {
    return true;
  }

  // Check prefixes for webhook endpoints
  if (path.startsWith("/api/billing/webhook")) {
    return true;
  }

  if (path.startsWith("/api/briefing/public/")) {
    return true;
  }

  return false;
}

/**
 * Universal auth guard - applies to all /api/* routes
 */
export function universalAuthGuard(req: Request, res: Response, next: NextFunction): void {
  // Skip if not an API route
  if (!req.path.startsWith("/api") && !req.path.startsWith("/whatsapp")) {
    next();
    return;
  }

  // Skip if public route
  if (isPublicRoute(req.path)) {
    next();
    return;
  }

  // Extract token from header or cookie
  let token: string | undefined;
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    token = header.slice(7);
  } else if (env.AUTH_HTTPONLY_COOKIES) {
    const c = req.cookies?.[ACCESS_COOKIE];
    if (typeof c === "string" && c.length > 0) {
      token = c;
    }
  }

  if (!token) {
    logger.warn("Unauthorized access attempt", {
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required" }
    });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.auth = {
      userId: payload.sub,
      role: payload.role,
      clientId: payload.clientId
    };
    next();
  } catch (err) {
    logger.warn("Invalid token", {
      path: req.path,
      method: req.method,
      ip: req.ip,
      error: err instanceof Error ? err.message : String(err)
    });
    res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Invalid or expired token" }
    });
  }
}

/**
 * Middleware to ensure user can only access their own data
 * Usage: requireOwnResource('userId', 'query') or requireOwnResource('clientId', 'body')
 */
export function requireOwnResource(
  fieldName: string,
  location: "query" | "body" | "params" = "query"
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const data = location === "query" ? req.query : location === "body" ? req.body : req.params;
    const requestedId = data[fieldName];

    // Agency admins can access any resource
    if (req.auth.role === "AGENCY_ADMIN") {
      next();
      return;
    }

    // For userId field, check against auth.userId
    if (fieldName === "userId") {
      if (requestedId !== req.auth.userId) {
        logger.warn("Unauthorized resource access attempt", {
          userId: req.auth.userId,
          requestedUserId: requestedId,
          path: req.path
        });
        res.status(403).json({ error: "Access denied" });
        return;
      }
    }

    // For clientId field, check against auth.clientId
    if (fieldName === "clientId") {
      if (!req.auth.clientId || requestedId !== req.auth.clientId) {
        logger.warn("Unauthorized client access attempt", {
          userId: req.auth.userId,
          userClientId: req.auth.clientId,
          requestedClientId: requestedId,
          path: req.path
        });
        res.status(403).json({ error: "Access denied to this client" });
        return;
      }
    }

    next();
  };
}
