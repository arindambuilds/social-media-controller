import { env } from "./env";

/**
 * Stripe Price ID for **PulseOS Pioneer** (₹600/mo INR recurring).
 * Set **`STRIPE_PRICE_PIONEER600_INR`** on the API host (Render) and mirror in dashboard
 * (`STRIPE_PRICE_PIONEER600_INR` or `NEXT_PUBLIC_STRIPE_PIONEER600_PRICE_ID` for client-side display).
 */
export function getPioneerSubscriptionPriceId(): string | undefined {
  const id = env.STRIPE_PRICE_PIONEER600_INR?.trim();
  return id && id.length > 0 ? id : undefined;
}
