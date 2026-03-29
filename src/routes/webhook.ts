import { Router } from "express";
import type { Request, Response } from "express";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import { matchesWebhookSignature } from "./webhooks";
import { processIncomingDm } from "../services/processInstagramDm";

export const instagramWebhookRouter = Router();

function resolveMetaAppSecret(): string {
  return (
    env.META_APP_SECRET?.trim() ||
    env.FACEBOOK_APP_SECRET?.trim() ||
    env.INSTAGRAM_APP_SECRET?.trim() ||
    ""
  );
}

instagramWebhookRouter.get("/", (req: Request, res: Response) => {
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

instagramWebhookRouter.post("/", (req: Request, res: Response) => {
  const secret = resolveMetaAppSecret();
  const buf = req.body instanceof Buffer ? req.body : Buffer.alloc(0);
  const sig = req.get("x-hub-signature-256")?.trim() ?? "";

  if (secret) {
    if (!buf.length || !sig || !matchesWebhookSignature(sig, buf, secret)) {
      res.status(403).json({ error: "Invalid signature" });
      return;
    }
  } else if (env.NODE_ENV === "production") {
    logger.warn("[instagram webhook] Meta app secret missing — rejecting POST in production");
    res.status(503).json({ error: "Webhook verification not configured" });
    return;
  } else {
    logger.warn("[instagram webhook] Meta app secret missing — skipping signature check (dev only)");
  }

  res.status(200).type("text/plain").send("OK");

  let parsed: unknown;
  try {
    parsed = JSON.parse(buf.toString("utf8"));
  } catch {
    logger.warn("[instagram webhook] Invalid JSON body");
    return;
  }

  void processIncomingDm(parsed).catch((err) => {
    logger.error("[instagram webhook] processIncomingDm failed", {
      message: err instanceof Error ? err.message : String(err)
    });
  });
});
