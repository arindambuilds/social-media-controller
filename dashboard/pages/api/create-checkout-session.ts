import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";

type Body = {
  priceId?: string;
  source?: string;
  feature?: string;
};

type AuthMeResponse = {
  user?: { id: string; email?: string | null } | null;
  success?: boolean;
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2026-03-25.dahlia"
});

function apiBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
  return raw.endsWith("/api") ? raw.slice(0, -4) : raw;
}

async function resolveUserFromToken(req: NextApiRequest): Promise<{ id: string; email: string | null } | null> {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const meRes = await fetch(`${apiBaseUrl()}/api/auth/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!meRes.ok) return null;
  const data = (await meRes.json()) as AuthMeResponse;
  if (!data.user?.id) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    res.status(500).json({ error: "Stripe not configured" });
    return;
  }

  const body = (req.body ?? {}) as Body;
  const priceId = body.priceId?.trim();
  const source = body.source?.trim() || null;
  const feature = body.feature?.trim() || null;
  if (!priceId) {
    res.status(400).json({ error: "Missing priceId" });
    return;
  }

  const user = await resolveUserFromToken(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const successUrl = `${process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3000"}/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3000"}/billing?canceled=true`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: user.email ?? undefined,
      metadata: {
        source: source ?? "",
        feature: feature ?? "",
        userId: user.id,
        priceId
      }
    });

    if (!session.url) {
      res.status(500).json({ error: "Failed to create checkout session" });
      return;
    }
    res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    res.status(500).json({ error: message });
  }
}

