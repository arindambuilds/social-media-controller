import { Router, raw } from "express";
import Stripe from "stripe";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { createNotification } from "../services/notificationService";

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
          void createNotification(agencyUserId, {
            type: "billing_checkout",
            title: "Subscription activated",
            message: `Your ${planId} plan is now active.`,
            metadata: {
              planId,
              stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : null
            }
          }).catch((e) =>
            logger.warn("[billing webhook] notification create failed", {
              message: e instanceof Error ? e.message : String(e)
            })
          );
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
          void createNotification(agencyUserId, {
            type: "billing_subscription_updated",
            title: "Subscription updated",
            message: `Your plan is now ${planId} (status: ${sub.status}).`,
            metadata: { planId, stripeSubscriptionId: sub.id, status: sub.status }
          }).catch((e) =>
            logger.warn("[billing webhook] notification create failed", {
              message: e instanceof Error ? e.message : String(e)
            })
          );
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
          void createNotification(agencyUserId, {
            type: "billing_subscription_ended",
            title: "Subscription ended",
            message: "Your subscription was cancelled. You are now on the free plan.",
            metadata: { stripeSubscriptionId: sub.id }
          }).catch((e) =>
            logger.warn("[billing webhook] notification create failed", {
              message: e instanceof Error ? e.message : String(e)
            })
          );
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
