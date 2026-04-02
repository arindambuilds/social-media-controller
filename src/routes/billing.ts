import { Router } from "express";
import Stripe from "stripe";
import { z } from "zod";
import { env } from "../config/env";
import { getPioneerSubscriptionPriceId } from "../config/stripe";
import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { requireAgency } from "../middleware/requireAgency";
import { resolveTenant } from "../middleware/resolveTenant";
import { getBillingStatus } from "../services/usageService";

export const billingRouter = Router();

billingRouter.use(authenticate);

const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2026-03-25.dahlia" })
  : null;

function assertStripeEnabled(): Stripe | null {
  if (!stripe) return null;
  return stripe;
}

billingRouter.get("/:clientId/status", resolveTenant, async (req, res) => {
  const { clientId } = z.object({ clientId: z.string().min(1) }).parse(req.params);
  const status = await getBillingStatus(clientId);
  res.json({ success: true, ...status });
});

billingRouter.post("/checkout", requireAgency, async (req, res) => {
  try {
    const parsed = z
      .object({
        planId: z.enum(["starter", "growth", "agency", "pioneer"]),
        /** Ignored for `pioneer` — server uses `STRIPE_PRICE_PIONEER600_INR`. */
        priceId: z.string().optional()
      })
      .parse(req.body ?? {});

    const pioneerPrice = getPioneerSubscriptionPriceId();
    let resolvedPriceId: string;
    if (parsed.planId === "pioneer") {
      if (!pioneerPrice) {
        res.status(503).json({
          error: "Pioneer plan is not configured. Set STRIPE_PRICE_PIONEER600_INR to your Stripe Price id (INR 600/mo)."
        });
        return;
      }
      resolvedPriceId = pioneerPrice;
    } else {
      const pid = parsed.priceId?.trim();
      if (!pid) {
        res.status(400).json({ error: "priceId is required for this plan." });
        return;
      }
      resolvedPriceId = pid;
    }

    const stripeClient = assertStripeEnabled();
    if (!stripeClient) {
      res.status(503).json({ error: "Stripe is not configured." });
      return;
    }

    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ error: "Not authenticated." });
      return;
    }

    const agencyUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, stripeCustomerId: true }
    });
    if (!agencyUser) {
      res.status(404).json({ error: "Agency user not found." });
      return;
    }

    let customerId = agencyUser.stripeCustomerId ?? null;
    if (!customerId) {
      const customer = await stripeClient.customers.create({
        email: agencyUser.email,
        name: agencyUser.name ?? agencyUser.email,
        metadata: { agencyUserId: agencyUser.id }
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: agencyUser.id },
        data: { stripeCustomerId: customerId }
      });
    }

    const session = await stripeClient.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
      success_url: `${env.DASHBOARD_URL}/billing?success=1`,
      cancel_url: `${env.DASHBOARD_URL}/billing?cancelled=1`,
      metadata: { agencyUserId: agencyUser.id, planId: parsed.planId },
      subscription_data: {
        metadata: { agencyUserId: agencyUser.id, planId: parsed.planId }
      }
    });

    res.json({ url: session.url });
  } catch (err) {
    logger.error("[POST /billing/checkout] failed", {
      message: err instanceof Error ? err.message : String(err)
    });
    res.status(500).json({ error: "Checkout failed" });
  }
});

billingRouter.post("/portal", requireAgency, async (req, res) => {
  try {
    const stripeClient = assertStripeEnabled();
    if (!stripeClient) {
      res.status(503).json({ error: "Stripe is not configured." });
      return;
    }
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ error: "Not authenticated." });
      return;
    }
    const agencyUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true }
    });
    if (!agencyUser?.stripeCustomerId) {
      res.status(400).json({ error: "No Stripe customer found" });
      return;
    }

    const session = await stripeClient.billingPortal.sessions.create({
      customer: agencyUser.stripeCustomerId,
      return_url: `${env.DASHBOARD_URL}/billing`
    });

    res.json({ url: session.url });
  } catch (err) {
    logger.error("[POST /billing/portal] failed", {
      message: err instanceof Error ? err.message : String(err)
    });
    res.status(500).json({ error: "Portal failed" });
  }
});
