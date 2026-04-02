import { Router } from "express";
import type { Request, Response } from "express";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import { dispatchWhatsAppCloudWebhookBody } from "./dispatcher";
import { whatsappHmacPreParseMiddleware } from "./hmac.middleware";

function resolveMetaAppSecret(): string {
  return (
    env.WA_APP_SECRET?.trim() ||
    env.META_APP_SECRET?.trim() ||
    env.FACEBOOK_APP_SECRET?.trim() ||
    env.INSTAGRAM_APP_SECRET?.trim() ||
    ""
  );
}

/** Mounted at `/whatsapp/webhook` in `app.ts` (Meta callback URL). */
export const waWebhookRouter = Router();

waWebhookRouter.get("/", (req: Request, res: Response) => {
  const mode = typeof req.query["hub.mode"] === "string" ? req.query["hub.mode"] : "";
  const token = typeof req.query["hub.verify_token"] === "string" ? req.query["hub.verify_token"] : "";
  const challenge = typeof req.query["hub.challenge"] === "string" ? req.query["hub.challenge"] : "";

  const expected = env.WEBHOOK_VERIFY_TOKEN.trim();
  if (mode === "subscribe" && expected.length > 0 && token === expected) {
    res.status(200).type("text/plain").send(challenge);
    return;
  }
  res.status(403).type("text/plain").send("Forbidden");
});

waWebhookRouter.post(
  "/",
  whatsappHmacPreParseMiddleware(resolveMetaAppSecret),
  (req: Request, res: Response) => {
    res.status(200).type("text/plain").send("OK");

    const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    let parsed: unknown;
    try {
      parsed = JSON.parse(buf.toString("utf8"));
    } catch (err) {
      logger.warn("[whatsapp webhook] invalid JSON", {
        message: err instanceof Error ? err.message : String(err)
      });
      return;
    }

    setImmediate(() => {
      void dispatchWhatsAppCloudWebhookBody(parsed).catch((err) => {
        logger.error("[whatsapp webhook] dispatch failed", {
          message: err instanceof Error ? err.message : String(err)
        });
      });
    });
  }
);

/** @deprecated Use `waWebhookRouter`; kept for any legacy imports. */
export const whatsappWebhookRouter = waWebhookRouter;
