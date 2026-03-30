import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { persistConversion } from "../../../utils/server/conversionStore";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2026-03-25.dahlia"
});

export const config = {
  api: {
    bodyParser: false
  }
};

async function readRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function centsToAmount(v: number | null | undefined): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return Math.round(v) / 100;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    res.status(500).json({ error: "Stripe webhook is not configured" });
    return;
  }

  const signature = req.headers["stripe-signature"];
  if (!signature || Array.isArray(signature)) {
    res.status(400).json({ error: "Missing Stripe signature" });
    return;
  }

  let event: Stripe.Event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid webhook signature";
    res.status(400).json({ error: message });
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await persistConversion({
          userId: session.metadata?.userId ?? null,
          plan: session.metadata?.priceId ?? "unknown",
          source: session.metadata?.source ?? null,
          feature: session.metadata?.feature ?? null,
          revenue: centsToAmount(session.amount_total),
          timestamp: Date.now(),
          customerId: typeof session.customer === "string" ? session.customer : null,
          customerEmail: session.customer_details?.email ?? null,
          priceId: session.metadata?.priceId ?? null,
          sessionId: session.id
        });
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const source =
          (invoice.parent as { subscription_details?: { metadata?: Record<string, string> } } | null | undefined)
            ?.subscription_details?.metadata?.source ?? null;
        const feature =
          (invoice.parent as { subscription_details?: { metadata?: Record<string, string> } } | null | undefined)
            ?.subscription_details?.metadata?.feature ?? null;
        const priceId =
          (invoice.parent as { subscription_details?: { metadata?: Record<string, string> } } | null | undefined)
            ?.subscription_details?.metadata?.priceId ?? null;
        const userId =
          (invoice.parent as { subscription_details?: { metadata?: Record<string, string> } } | null | undefined)
            ?.subscription_details?.metadata?.userId ?? null;

        await persistConversion({
          userId,
          plan: priceId ?? "subscription_renewal",
          source,
          feature,
          revenue: centsToAmount(invoice.amount_paid),
          timestamp: Date.now(),
          customerId: typeof invoice.customer === "string" ? invoice.customer : null,
          customerEmail: invoice.customer_email ?? null,
          priceId,
          sessionId: null
        });
        break;
      }
      default:
        break;
    }
    res.status(200).json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook processing failed";
    res.status(500).json({ error: message });
  }
}

