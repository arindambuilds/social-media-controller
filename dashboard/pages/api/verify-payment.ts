import crypto from "node:crypto";
import type { NextApiRequest, NextApiResponse } from "next";

const PIONEER_PLAN_ID = "pioneer";
const DEFAULT_LOCAL_API_ORIGIN = "http://localhost:4000";
const DEFAULT_PRODUCTION_API_ORIGIN = "https://social-media-controller.onrender.com";
const MOCK_LOCAL_SIGNATURE = "mock_local_signature";

type Body = {
  planId?: string;
  source?: string;
  feature?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
};

function apiBaseUrl(): string {
  const raw = (
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    (process.env.NODE_ENV === "production" ? DEFAULT_PRODUCTION_API_ORIGIN : DEFAULT_LOCAL_API_ORIGIN)
  ).replace(/\/$/, "");
  return raw.endsWith("/api") ? raw.slice(0, -4) : raw;
}

function isLocalMockPayment(
  orderId: string | undefined,
  paymentId: string | undefined,
  signature: string | undefined
): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    Boolean(orderId?.startsWith("mock_order_")) &&
    Boolean(paymentId?.startsWith("mock_payment_")) &&
    signature === MOCK_LOCAL_SIGNATURE
  );
}

function readErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const record = body as Record<string, unknown>;
  if (typeof record.error === "string" && record.error.trim()) return record.error;
  if (typeof record.message === "string" && record.message.trim()) return record.message;
  return fallback;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!process.env.RAZORPAY_KEY_SECRET) {
    res.status(500).json({ error: "Razorpay verification is not configured" });
    return;
  }

  const body = (req.body ?? {}) as Body;
  const planId = body.planId?.trim() || PIONEER_PLAN_ID;
  const razorpayOrderId = body.razorpay_order_id?.trim();
  const razorpayPaymentId = body.razorpay_payment_id?.trim();
  const razorpaySignature = body.razorpay_signature?.trim();
  const mockLocalPayment = isLocalMockPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature);

  if (planId !== PIONEER_PLAN_ID) {
    res.status(400).json({ error: "Only Pioneer plan verification is supported right now." });
    return;
  }
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    res.status(400).json({ error: "Missing Razorpay payment details." });
    return;
  }
  if (!process.env.RAZORPAY_KEY_SECRET && !mockLocalPayment) {
    res.status(500).json({ error: "Razorpay verification is not configured" });
    return;
  }

  if (!mockLocalPayment) {
    const payload = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET ?? "")
      .update(payload)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    const providedBuffer = Buffer.from(razorpaySignature, "utf8");
    if (expectedBuffer.length !== providedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
      res.status(400).json({ error: "Invalid signature" });
      return;
    }
  }

  try {
    const activationRes = await fetch(`${apiBaseUrl()}/api/billing/activate`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        planId: PIONEER_PLAN_ID,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
      })
    });

    const activationBody = (await activationRes.json().catch(() => ({}))) as Record<string, unknown>;
    if (!activationRes.ok) {
      res.status(500).json({ error: readErrorMessage(activationBody, "Payment verification succeeded, but plan activation failed.") });
      return;
    }

    res.status(200).json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payment verification failed";
    res.status(500).json({ error: message });
  }
}
