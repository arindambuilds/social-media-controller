import type { Request } from "express";
import rateLimit from "express-rate-limit";
import { createOptionalRedisRateLimitStore } from "./rateLimitStore";

function tenantKey(req: Request): string {
  const auth = req.auth;
  const uid = auth?.userId ?? `ip:${req.ip ?? "unknown"}`;
  const p = req.params as Record<string, string | undefined>;
  let tenant = p.clientId;
  if (!tenant && typeof req.query.clientId === "string") tenant = req.query.clientId;
  if (!tenant && req.body && typeof req.body === "object" && typeof (req.body as { clientId?: string }).clientId === "string") {
    tenant = (req.body as { clientId: string }).clientId;
  }
  return `${uid}:${tenant ?? "none"}`;
}

export const tenantRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  store: createOptionalRedisRateLimitStore("rl:tenant:"),
  passOnStoreError: true,
  keyGenerator: (req) => tenantKey(req)
});
