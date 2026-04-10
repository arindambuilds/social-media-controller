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

/**
 * GET /whatsapp/webhook - Meta webhook verification
 * Meta sends: ?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=CHALLENGE
 * We must return the challenge string if token matches
 */
waWebhookRouter.get("/", (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  // Verify the webhook
  if (mode === "subscribe" && token === env.WEBHOOK_VERIFY_TOKEN) {
    logger.info("[whatsapp webhook] Verification successful");
    res.status(200).send(challenge);
  } else {
    logger.warn("[whatsapp webhook] Verification failed", {
      mode,
      tokenMatch: token === env.WEBHOOK_VERIFY_TOKEN
    });
    res.status(403).send("Forbidden");
  }
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
