import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { emailConfig } from "../../config/env";
import { addSuppression, updateEmailStatus } from "../../services/email";

export const emailWebhooksRouter = Router();

function hasValidPostmarkWebhookSecret(headerValue: string | undefined): boolean {
  if (!emailConfig.postmarkWebhookSecret) return false;
  return headerValue === emailConfig.postmarkWebhookSecret;
}

emailWebhooksRouter.post("/postmark", async (req, res) => {
  const token = req.get("x-postmark-webhook-token") || undefined;
  if (!emailConfig.postmarkWebhookSecret) {
    res.status(403).json({ error: "Postmark webhook secret is not configured." });
    return;
  }
  if (!hasValidPostmarkWebhookSecret(token)) {
    res.status(401).json({ error: "Invalid Postmark webhook token." });
    return;
  }

  const recordType = typeof req.body?.RecordType === "string" ? req.body.RecordType : "";
  const messageId = typeof req.body?.MessageID === "string" ? req.body.MessageID : "";
  const email = typeof req.body?.Email === "string" ? req.body.Email.toLowerCase() : "";
  const description = typeof req.body?.Description === "string" ? req.body.Description : undefined;
  const bounceType = typeof req.body?.BounceType === "string" ? req.body.BounceType : undefined;

  if (!messageId) {
    res.status(200).json({ status: "ignored" });
    return;
  }

  const log = await prisma.emailLog.findFirst({ where: { providerMessageId: messageId } });
  if (!log) {
    res.status(200).json({ status: "ignored" });
    return;
  }

  if (recordType === "Bounce") {
    await updateEmailStatus(log.id, "BOUNCED", {
      errorMessage: description,
      isBounced: true,
      suppressionReason: bounceType || "bounce"
    });
    if (email) await addSuppression(email, "bounce");
  } else if (recordType === "SpamComplaint") {
    await updateEmailStatus(log.id, "SPAM_COMPLAINT", {
      errorMessage: description,
      isBounced: true,
      suppressionReason: "spam_complaint"
    });
    if (email) await addSuppression(email, "spam_complaint");
  } else if (recordType === "Delivery") {
    await updateEmailStatus(log.id, "DELIVERED");
  }

  res.status(200).json({ status: "ok" });
});
