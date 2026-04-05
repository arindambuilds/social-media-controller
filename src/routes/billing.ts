import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { requireAgency } from "../middleware/requireAgency";
import { resolveTenant } from "../middleware/resolveTenant";
import { writeAuditLog } from "../services/auditLogService";
import { createNotification } from "../services/notificationService";
import { getBillingStatus } from "../services/usageService";

export const billingRouter = Router();

billingRouter.use(authenticate);

billingRouter.get("/:clientId/status", resolveTenant, async (req, res) => {
  const { clientId } = z.object({ clientId: z.string().min(1) }).parse(req.params);
  const status = await getBillingStatus(clientId);
  res.json({ success: true, ...status });
});

billingRouter.post("/activate", requireAgency, async (req, res) => {
  try {
    const parsed = z
      .object({
        planId: z.literal("pioneer"),
        razorpayOrderId: z.string().min(1),
        razorpayPaymentId: z.string().min(1),
        razorpaySignature: z.string().min(1)
      })
      .parse(req.body ?? {});

    const razorpaySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
    if (!razorpaySecret) {
      res.status(500).json({ error: "Razorpay verification is not configured." });
      return;
    }

    const payload = `${parsed.razorpayOrderId}|${parsed.razorpayPaymentId}`;
    const expectedSignature = crypto.createHmac("sha256", razorpaySecret).update(payload).digest("hex");
    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    const providedBuffer = Buffer.from(parsed.razorpaySignature, "utf8");
    if (expectedBuffer.length !== providedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
      res.status(400).json({ error: "Invalid Razorpay signature." });
      return;
    }

    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ error: "Not authenticated." });
      return;
    }

    const agencyUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, clientId: true, plan: true }
    });
    if (!agencyUser) {
      res.status(404).json({ error: "Agency user not found." });
      return;
    }

    if (agencyUser.plan !== parsed.planId) {
      await prisma.user.update({
        where: { id: agencyUser.id },
        data: {
          plan: parsed.planId,
          stripeSubscriptionId: null,
          planActivatedAt: new Date()
        }
      });

      await writeAuditLog({
        clientId: agencyUser.clientId ?? null,
        actorId: agencyUser.id,
        action: "BILLING_PLAN_ACTIVATED",
        entityType: "User",
        entityId: agencyUser.id,
        metadata: {
          planId: parsed.planId,
          provider: "razorpay",
          razorpayOrderId: parsed.razorpayOrderId,
          razorpayPaymentId: parsed.razorpayPaymentId
        },
        ipAddress: req.ip
      });

      void createNotification(agencyUser.id, {
        type: "billing_checkout",
        title: "Pioneer plan activated",
        message: "Your Pioneer plan is now active and ready to use.",
        metadata: {
          planId: parsed.planId,
          provider: "razorpay",
          razorpayOrderId: parsed.razorpayOrderId,
          razorpayPaymentId: parsed.razorpayPaymentId,
          razorpaySignature: parsed.razorpaySignature
        }
      }).catch((e) =>
        logger.warn("[POST /billing/activate] notification create failed", {
          message: e instanceof Error ? e.message : String(e)
        })
      );
    }

    res.json({ success: true, plan: parsed.planId });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid payment activation payload." });
      return;
    }
    logger.error("[POST /billing/activate] failed", {
      message: err instanceof Error ? err.message : String(err)
    });
    res.status(500).json({ error: "Payment activation failed" });
  }
});

billingRouter.post("/checkout", requireAgency, (_req, res) => {
  res.status(200).json({
    provider: "razorpay",
    message: "Use /api/create-checkout-session on the dashboard"
  });
});

billingRouter.post("/portal", requireAgency, (_req, res) => {
  res.status(501).json({
    error: "Billing portal is not available yet. Manage your Pioneer plan from the dashboard billing page."
  });
});
