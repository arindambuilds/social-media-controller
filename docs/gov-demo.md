# Gov demo — PulseOS (production status, March 2026)

> INTERNAL USE ONLY
>
> This document mixes stakeholder demo framing with internal operator access details. Share only a trimmed customer-safe version, not this working runbook.

**Purpose:** Single place for **Startup Odisha**, **MSME Department**, and investor-facing demos: what is live, where to click, and how it is verified.

## Live URLs

| Surface | URL | Notes |
|--------|-----|--------|
| **API (Render)** | `https://social-media-controller.onrender.com` | JWT auth, analytics, AI, billing, `GET /api/pulse/gov-preview` |
| **Dashboard — gov preview** | `https://pulseos.vercel.app/gov-preview` | Public ISR page; **`NEXT_PUBLIC_API_URL`** must point at the Render API |
| **Operator login (smoke)** | `demo@demo.com` / `Demo1234!` | Canonical demo tenant; see `prisma/seed.ts` |

## Production status (ground truth)

- **Migrations:** `prisma migrate deploy` on production DB (see `DEPLOYMENT.md`).
- **Smoke contract:** **7/7** — `npm run smoke-demo -- --url https://social-media-controller.onrender.com` (or `npm run smoke:render`).
- **CI / local tests:** **68/68** Vitest — `npm test` (includes Odia **`morningBriefing`** tests in `tests/briefing.test.ts`).
- **Morning briefing (Odia):** `Client.language = or` (or alias `odia`) → **`morningBriefing`** in `src/lib/claudeClient.ts` via `generateBriefing(..., { clientLanguage })` in `src/services/briefingAgent.ts`.
- **9:00 IST BullMQ:** `BRIEFING_DISPATCH_MODE=nine_am_ist` → scheduler id **`whatsapp-briefing-9am-ist`**, pattern **`0 9 * * *`**, **`tz: Asia/Kolkata`** (`src/queues/whatsappBriefingQueue.ts`).
- **Stripe Pioneer (₹600/mo):** API reads **`STRIPE_PRICE_PIONEER600_INR`** through **`src/config/stripe.ts`**; dashboard checkout uses the same id via env (see `docs/stripe-pioneer-plan.md`).

## What to show in 3 minutes

1. Open **`/gov-preview`** — public metrics narrative (may lag up to ~1h ISR).
2. Log in on the dashboard → analytics / insights (authenticated).
3. Mention **daily WhatsApp briefing** at **9:00 Asia/Kolkata** for pilot MSMEs (BullMQ + workers on Render).

## Related

- [`docs/PRODUCTION-READY-DELIVERABLES.md`](./PRODUCTION-READY-DELIVERABLES.md) — full 31 March 2026 deliverables pack  
- [`docs/briefing-9am-ist-rehearsal.md`](./briefing-9am-ist-rehearsal.md) — scheduler + rehearsal  
- [`quadrapilot/TRUTH_TABLE.md`](../quadrapilot/TRUTH_TABLE.md) — QuadraPilot verification table  
