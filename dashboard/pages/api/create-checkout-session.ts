import type { NextApiRequest, NextApiResponse } from "next";
import Razorpay from "razorpay";

type Body = {
  planId?: string;
  source?: string;
  feature?: string;
};

type AuthMeResponse = {
  user?: { id: string; email?: string | null; name?: string | null } | null;
  success?: boolean;
};

const PIONEER_PLAN_ID = "pioneer";
const PIONEER_AMOUNT_PAISE = 60_000;
const PIONEER_CURRENCY = "INR";
const DEFAULT_LOCAL_API_ORIGIN = "http://localhost:4000";
const DEFAULT_PRODUCTION_API_ORIGIN = "https://social-media-controller.onrender.com";

function apiBaseUrl(): string {
  const raw = (
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    (process.env.NODE_ENV === "production" ? DEFAULT_PRODUCTION_API_ORIGIN : DEFAULT_LOCAL_API_ORIGIN)
  ).replace(/\/$/, "");
  return raw.endsWith("/api") ? raw.slice(0, -4) : raw;
}

function buildReceipt(userId: string): string {
  const safeUserId = userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "pulse";
  return `receipt_${safeUserId}_${Date.now()}`.slice(0, 40);
}

async function resolveUserFromToken(
  req: NextApiRequest
): Promise<{ id: string; email: string | null; name: string | null } | null> {
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
  return {
    id: data.user.id,
    email: data.user.email ?? null,
    name: data.user.name ?? null
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    res.status(500).json({ error: "Razorpay is not configured" });
    return;
  }

  const body = (req.body ?? {}) as Body;
  const planIdRaw = body.planId?.trim();
  if (planIdRaw !== PIONEER_PLAN_ID) {
    res.status(400).json({ error: "Only the Pioneer plan is available in Razorpay checkout right now." });
    return;
  }

  const user = await resolveUserFromToken(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const source = body.source?.trim() || "";
    const feature = body.feature?.trim() || "";
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID ?? "",
      key_secret: process.env.RAZORPAY_KEY_SECRET ?? ""
    });
    const order = await razorpay.orders.create({
      amount: PIONEER_AMOUNT_PAISE,
      currency: PIONEER_CURRENCY,
      receipt: buildReceipt(user.id),
      notes: {
        userId: user.id,
        planId: PIONEER_PLAN_ID,
        source,
        feature
      }
    });

    res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() || process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create Razorpay order";
    res.status(500).json({ error: message });
  }
}

