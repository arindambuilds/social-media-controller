import type { NextFunction, Request, Response } from "express";
import { matchesWebhookSignature } from "../routes/webhooks";

export const WHATSAPP_HMAC_LOCAL_KEY = "whatsappHmacVerified" as const;

function readRawBody(req: Request): Buffer {
  if (Buffer.isBuffer(req.body)) {
    return req.body;
  }
  return Buffer.alloc(0);
}

/**
 * Verifies Meta `X-Hub-Signature-256` against the raw body **before** JSON.parse.
 * Returns false when secret is empty, header missing, or digest mismatch.
 */
export function verifyWhatsAppHubSignature256(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  appSecret: string
): boolean {
  const secret = appSecret.trim();
  if (!secret.length) {
    return false;
  }
  const sig = signatureHeader?.trim() ?? "";
  if (!rawBody.length || !sig) {
    return false;
  }
  return matchesWebhookSignature(sig, rawBody, secret);
}

export type WhatsAppSecretResolver = () => string;

/**
 * Express middleware: verifies HMAC on the raw body before JSON.parse.
 * On success sets `res.locals.whatsappHmacVerified` and calls `next()`.
 * On failure responds **403** and does not call `next()`.
 */
export function whatsappHmacPreParseMiddleware(resolveSecret: WhatsAppSecretResolver) {
  return function whatsappHmacPreParse(req: Request, res: Response, next: NextFunction): void {
    try {
      const raw = readRawBody(req);
      const secret = resolveSecret();
      const header = req.get("x-hub-signature-256");
      const ok = verifyWhatsAppHubSignature256(raw, header, secret);
      if (!ok) {
        res.status(403).json({ error: "Invalid signature" });
        return;
      }
      res.locals[WHATSAPP_HMAC_LOCAL_KEY] = true;
      next();
    } catch {
      res.status(403).json({ error: "Invalid signature" });
    }
  };
}

export function isWhatsAppHmacVerified(res: Response): boolean {
  return res.locals[WHATSAPP_HMAC_LOCAL_KEY] === true;
}
