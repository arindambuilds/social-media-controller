# Stripe — PulseOS Pioneer Plan (₹600 / month)

> INTERNAL USE ONLY
>
> This pricing runbook is for product and operator use. Keep it private if it contains test accounts, internal Stripe setup notes, or demo-only flows.

**Goal:** Talk about and demo pricing without hand-waving. Wire is in the API and dashboard once you create the Price in Stripe.

## 1. Create in Stripe Dashboard (test or live)

1. **Product:** name **`PulseOS Pioneer Plan`** (description optional).
2. **Price:**  
   - **Currency:** INR  
   - **Amount:** **600**  
   - **Billing period:** monthly (recurring)  
3. Copy the **Price id** (`price_…`). Example placeholder name in specs: **`price_pioneer600_inr`** — Stripe generates the real id.

## 2. Environment variables

| Where | Variable | Value |
|-------|-----------|--------|
| **API (Render)** | `STRIPE_PRICE_PIONEER600_INR` | `price_…` from Stripe |
| **API** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | As today |
| **Dashboard (Vercel)** | `NEXT_PUBLIC_STRIPE_PIONEER600_PRICE_ID` | Same `price_…` (for `/billing` UI + checkout) |
| **Dashboard (optional)** | `STRIPE_PRICE_PIONEER600_INR` | Same id — used by `pages/api/create-checkout-session` if set (otherwise public var) |

Root **`.env.example`** and **`dashboard/.env.example`** list these keys.

## 3. How checkout uses Pioneer (server-trusted price)

- **API helper:** `src/config/stripe.ts` → **`getPioneerSubscriptionPriceId()`** reads **`STRIPE_PRICE_PIONEER600_INR`** (used by **`src/routes/billing.ts`**). Dashboard checkout should set the same id via **`STRIPE_PRICE_PIONEER600_INR`** or **`NEXT_PUBLIC_STRIPE_PIONEER600_PRICE_ID`** on Vercel.
- **`POST /api/billing/checkout`** (agency JWT): body **`{ "planId": "pioneer" }`** — **`priceId` is ignored** for this tier; the API always resolves the Pioneer price from env.
- Other plans still require **`priceId`** + **`planId`** in `starter` | `growth` | `agency`.
- **Dashboard** `/billing`: **Pioneer** card calls **`/api/create-checkout-session`** with **`planId: "pioneer"`** so the server resolves the price from env (avoids trusting the browser for the tier).

Webhook **`checkout.session.completed`** on the API sets **`user.plan`** from metadata **`planId`** (includes **`pioneer`**).

## 4. Optional billing smoke (test-mode keys on API)

```bash
# API running with STRIPE_SECRET_KEY + STRIPE_PRICE_PIONEER600_INR set
npm run smoke:billing-pioneer
# or remote
npx tsx scripts/smoke-billing-pioneer.ts --url https://your-api.onrender.com
```

Uses **`demo@demo.com` / `Demo1234!`** — must be **`AGENCY_ADMIN`**. Prints the **Stripe Checkout URL** on success.

## 5. Demo flow

1. Set env vars and redeploy API + dashboard.  
2. Open **`/billing`** → **Join Pioneer →** → complete redirect to Stripe Checkout (test card in test mode).  
3. Mention **₹600/mo** and cohort story (see **`UpgradeModal`** pioneer copy on other pages).
