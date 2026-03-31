# Final demo hardening (last 24 hours before Startup Odisha / government)

**Goal:** No surprises on the day — production URLs, frozen surface, simple narratives.

## 1. Full end-to-end rehearsal (real stack)

Tell the story in order:

1. **Onboard an MSME** (or use seeded **Aroma** / demo client).  
2. **WhatsApp in Odia** — at least one real message round-trip.  
3. **AI → DB** — briefing or DM path persists as expected.  
4. **9:00 Asia/Kolkata** — either observe the real tick or use the **one-off E2E** path in [`quadrapilot/README.md`](../quadrapilot/README.md) (C1).  
5. **`/gov-preview`** on **Vercel** — metrics within **~1 hour** of cache refresh (ISR **3600s**).  

**Rule:** rehearse on **production** hosts (Render + Vercel), not **localhost**, for the final pass.

## 2. Freeze critical backend files

Treat as **frozen** unless fixing a **P0/P1** bug:

| Area | Files (do not touch for “cleanup”) |
|------|--------------------------------------|
| PDF / Redis pipeline | `src/lib/pdfQueueObservability.ts`, `src/lib/pdfQueueMetricsFlush.ts`, `src/queues/pdfQueue.ts`, `src/jobs/redisStreamMaintenance.ts` |
| Cron / briefing wiring | `src/queues/whatsappBriefingQueue.ts`, `src/queues/briefingQueue.ts`, `src/jobs/briefingDispatch.ts` (unless coordinated with a rehearsal) |

If you **must** change any of the above: rerun **`npm test`**, **`npx tsc --noEmit`**, **`npm run lint`**, **`npm run build`**, **`npm run smoke:render`** (target **7/7**), and **`npm run dashboard:build`**.

## 3. Spoken narrative (two audiences)

**Non-technical (government / MSME room):**

> We run a **9:00 AM (Asia/Kolkata)** automation that reads live WhatsApp usage and updates this **`/gov-preview`** dashboard.

**Technical (co-founder / angels):**

> **BullMQ** repeatable with **`tz: "Asia/Kolkata"`** (`0 9 * * *` for the nine-am queue mode), **Prisma** migrations on Supabase/Render, **7/7** remote smoke (`scripts/smoke-demo.ts`), **68/68** Vitest suite (current baseline — run `npm test` before claiming).

## 4. Same-day checklist

- [ ] `npm run smoke:render` → **7/7**  
- [ ] `GET /api/pulse/gov-preview` → **200** + JSON on Render  
- [ ] Vercel **`NEXT_PUBLIC_API_URL`** → correct API origin  
- [ ] **`STRIPE_PRICE_PIONEER600_INR`** set if showing Pioneer checkout ([`stripe-pioneer-plan.md`](./stripe-pioneer-plan.md))  
- [ ] Odia proof assets loaded on laptop ([`odia-demo-sanity-check.md`](./odia-demo-sanity-check.md))  

## Related

- [`cycle3-antigravity-tech-status.md`](./cycle3-antigravity-tech-status.md)  
- [`production-parity-runbook.md`](./production-parity-runbook.md)  
- [`vercel-gov-preview-wiring.md`](./vercel-gov-preview-wiring.md)  
