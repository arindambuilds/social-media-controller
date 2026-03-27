import { NextFunction, Request, Response } from "express";
import { z } from "zod";

/**
 * Minimal tenant guard for MVP routes that include :clientId.
 * - AGENCY_ADMIN can access any clientId.
 * - CLIENT_USER can only access the clientId embedded in their token.
 */
export function resolveTenant(req: Request, res: Response, next: NextFunction): void {
  const params = z.object({ clientId: z.string().min(1) }).safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Missing clientId." });
    return;
  }

  const auth = req.auth;
  if (!auth) {
    res.status(401).json({ error: "Unauthenticated." });
    return;
  }

  if (auth.role === "AGENCY_ADMIN") {
    next();
    return;
  }

  if (auth.clientId && auth.clientId === params.data.clientId) {
    next();
    return;
  }

  res.status(403).json({ error: "Forbidden for this client." });
}

/**
 * Same rules as resolveTenant, but reads `clientId` from JSON body (e.g. POST /ai/captions/generate).
 */
export function resolveTenantFromBody(clientIdKey = "clientId") {
  return (req: Request, res: Response, next: NextFunction): void => {
    const raw = (req.body ?? {}) as Record<string, unknown>;
    const clientId = typeof raw[clientIdKey] === "string" ? raw[clientIdKey] : "";
    if (!clientId) {
      res.status(400).json({ error: `Missing ${clientIdKey} in body.` });
      return;
    }

    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ error: "Unauthenticated." });
      return;
    }

    if (auth.role === "AGENCY_ADMIN") {
      next();
      return;
    }

    if (auth.clientId && auth.clientId === clientId) {
      next();
      return;
    }

    res.status(403).json({ error: "Forbidden for this client." });
  };
}
