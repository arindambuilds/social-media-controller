import { Router, raw } from "express";
import Stripe from "stripe";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

export const billingWebhookRouter = Router();

const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2026-03-25.dahlia" })
  : null;

billingWebhookRouter.post("/webhook", raw({ type: "application/json" }), async (req, res) => {
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    res.status(503).json({ error: "Stripe webhook is not configured." });
    return;
  }

  const sig = req.headers["stripe-signature"];
  if (typeof sig !== "string") {
    res.status(400).json({ error: "Missing stripe-signature header" });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.warn("[billing webhook] signature verification failed", {
      message: err instanceof Error ? err.message : String(err)
    });
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const agencyUserId = session.metadata?.agencyUserId;
        const planId = session.metadata?.planId;
        if (agencyUserId && planId) {
          await prisma.user.update({
            where: { id: agencyUserId },
            data: {
              plan: planId,
              stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : null,
              planActivatedAt: new Date()
            }
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const agencyUserId = sub.metadata?.agencyUserId;
        const planId = sub.metadata?.planId;
        if (agencyUserId && planId) {
          await prisma.user.update({
            where: { id: agencyUserId },
            data: { plan: planId, stripeSubscriptionId: sub.id }
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const agencyUserId = sub.metadata?.agencyUserId;
        if (agencyUserId) {
          await prisma.user.update({
            where: { id: agencyUserId },
            data: { plan: "free", stripeSubscriptionId: null }
          });
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    logger.error("[billing webhook] handler error", {
      message: err instanceof Error ? err.message : String(err)
    });
    res.status(500).json({ error: "Webhook handler failed" });
    return;
  }

  res.json({ received: true });
});
