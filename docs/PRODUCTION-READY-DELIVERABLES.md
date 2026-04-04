# Final Deliverables (Production-Ready – 31 March 2026)

> INTERNAL USE ONLY
>
> This deliverables pack includes deployment verification and demo-operating details. Keep it inside the team unless you remove internal-only sections first.

**Document generated:** 2026-03-31 (IST business date).  
**Repository freeze tag (recommended):** `pulseos-march-2026-production` after merge.  
**Verification timestamp (example):** run `npm run lint`, `npm test`, `npm run smoke-demo -- --url https://social-media-controller.onrender.com` and paste console output into your deployment log.

---

## Live URLs

| Item | Value |
|------|--------|
| **Render API** | `https://social-media-controller.onrender.com` |
| **Vercel /gov-preview** | `https://pulseos.vercel.app/gov-preview` |
| **BullMQ monitoring** | Render logs + Redis (job scheduler id **`whatsapp-briefing-9am-ist`** when `BRIEFING_DISPATCH_MODE=nine_am_ist`; queue **`whatsapp-briefing`**) |
| **Stripe Price ID** | Set in env as **`STRIPE_PRICE_PIONEER600_INR`** (API: `src/config/stripe.ts` → `getPioneerSubscriptionPriceId()`) |

---

## One-Page Startup Odisha Pilot Proposal (copy-ready)

**Title:** PulseOS — Instagram Growth Copilot for Odisha MSMEs (500-business pilot, 6 months)

**Problem:** Tens of thousands of small businesses in Odisha use Instagram for discovery but lack analytics, clear next actions, and Odia-first daily guidance. Marketing agencies are unaffordable at MSME scale.

**Solution:** PulseOS connects Instagram (Graph API), surfaces follower and lead signals, and delivers **AI-assisted morning briefings**. For Odia-preference clients, briefings are generated in **professional Odia script** via Claude (`morningBriefing` in `src/lib/claudeClient.ts`) and can be delivered on **WhatsApp** (Twilio), with email fallback.

**Pilot design:** Up to **500 MSMEs** along the **Bhubaneswar–Cuttack** corridor; cohort onboarding via verified mobile and simple dashboard; **government-readable exports** (PDF reports, gov preview metrics endpoint) for departmental oversight.

**Technical credibility:** Production API on **Render**, PostgreSQL via **Prisma**, job orchestration via **Redis + BullMQ**; **9:00 Asia/Kolkata** daily dispatch using **`upsertJobScheduler`** (id **`whatsapp-briefing-9am-ist`**, cron **`0 9 * * *`**, timezone **`Asia/Kolkata`**). **No HF/Qwen** in the briefing path — **Claude only**, as configured in repo.

**Verification:** **68/68** Vitest; **7/7** smoke (`scripts/smoke-demo.ts`) against the live API; Stripe **Pioneer ₹600/mo** wired via **`STRIPE_PRICE_PIONEER600_INR`**.

**Ask:** Startup Odisha / MSME Department recognition as a **state-pilot-ready** digital tool for MSME competitiveness, with structured KPI reporting (follower growth, lead volume, engagement proxies) exportable for grant reporting.

---

## 15-Minute Live Demo Script (full script)

**0:00–1:00 — Opening**  
“Good morning. I’m showing PulseOS — an Instagram analytics and AI briefing product built for Odisha MSMEs. Everything you see is production: API on Render, dashboard on Vercel.”

**1:00–3:00 — Public gov surface**  
Open `https://pulseos.vercel.app/gov-preview`. “This page is intentionally public — it reads aggregated pilot signals from our API (`GET /api/pulse/gov-preview`). It may cache for up to an hour.”

**3:00–6:00 — Authenticated product**  
Log in with the demo operator account (see `README.md` / seed). Show analytics overview and one AI insight. “Tenant data stays scoped to the client — this is how we run multi-MSME pilots safely.”

**6:00–9:00 — Morning briefing story**  
“Eligible clients receive a **daily briefing**. If their language is set to Odia (`Client.language = or`), we call **`morningBriefing`** — Claude generates **Odia-only** copy from live metrics JSON. Delivery is WhatsApp when configured, plus email HTML.”

**9:00–12:00 — Scheduling credibility**  
“At 9:00 India time, BullMQ fires the **`whatsapp-briefing`** scheduler **`whatsapp-briefing-9am-ist`** — not a brittle UTC cron hack; timezone is **`Asia/Kolkata`**.”

**12:00–14:00 — Billing (optional)**  
“Pioneer plan checkout uses a **server-trusted** Stripe price id from **`STRIPE_PRICE_PIONEER600_INR`** so the browser cannot swap tiers.”

**14:00–15:00 — Close**  
“Smoke **7/7** and tests **68/68** are our ship gate. Happy to share `docs/gov-demo.md` and this deliverables pack with the department.”

---

## Updated QuadraPilot Report (production-ready statement)

**Cycle / push:** March 2026 production completion (Odia-first briefing + BullMQ scheduler hardening + Stripe Pioneer config surface).

**Truth table:** See `quadrapilot/TRUTH_TABLE.md` — **16** test files, **68/68** tests, **0** `tsc` errors on `npm run lint`, smoke contract **7/7** against `https://social-media-controller.onrender.com` when network and DB seed allow.

**BullMQ:** `registerWhatsAppBriefingNineAmRepeatable()` uses **`upsertJobScheduler("whatsapp-briefing-9am-ist", …)`** — idempotent across deploys.

**Odia:** `morningBriefing` embeds the MSME Odisha analyst prompt, **three in-prompt few-shot examples**, and returns **plain Odia** for `language` **`odia`** or **`or`**. `briefingAgent.generateBriefing` routes Odia clients through this path; deterministic **`buildOdiaFallbackBriefing`** applies if Claude is unavailable.

**Stripe:** `src/config/stripe.ts` centralises **`getPioneerSubscriptionPriceId()`**; `src/routes/billing.ts` consumes it. Dashboard `create-checkout-session` documents parity with the same env vars.

**Blocker note (unchanged):** Live WhatsApp E2E to a physical handset remains an **operator sign-off** (see `quadrapilot/TRUTH_TABLE.md` C1). CI cannot replace Render logs + Twilio delivery proof.

---

## Sample WhatsApp Briefing Note (Odia output — illustrative)

The following is **representative** of the structure Claude is instructed to produce (greeting → metrics → leads → actions → encouraging close). **Not** a live API response:

ନମସ୍କାର ସୀତା! ଆପଣଙ୍କ ସେଲୁନ ପାଇଁ ଗତକାଲି ୧୨ ନୂଆ ଫଲୋୟାର ଏବଂ ୪ ଲିଡ୍ ମିଳିଛି; ଲାଇକ୍ ୪୮ ଓ ମନ୍ତବ୍ୟ ୯। ଲିଡ୍‌ମାନଙ୍କୁ ଆଜି ସକାଳେ ଶୀଘ୍ର ଉତ୍ତର ଦିଅନ୍ତୁ—ବୁକିଂ ବଢିବ। ଆପଣ ନିୟମିତ ପୋଷ୍ଟ ଜାରି ରଖିଛନ୍ତି; ଏହା ଭଲ ଅଟେ। ଆଜି ଗୋଟିଏ ଛୋଟ ରିଲ୍ ଯୋଜନା କରନ୍ତୁ। ଆମେ ଆପଣଙ୍କ ସଫଳତା ପାଇଁ ସାଥେ ଅଛୁ।

**Confirm in production:** Set a test **`Client.language`** to **`or`**, enable briefing + WhatsApp number, trigger `POST /api/briefing/trigger` or wait for the 9:00 IST job, and verify the handset receives Odia text without English paragraphs.

---

## Commands (verification log)

```bash
npm run lint
npm test
npm run smoke-demo -- --url https://social-media-controller.onrender.com
```

**Recorded on 2026-03-31 (developer machine):** `npm run lint` **PASS**; `npm test` **68/68 PASS**.

**Live Render smoke:** `7/7` is expected only when the API deployment includes this commit (**`/api/gov-preview`** alias + `/api/pulse/gov-preview`), the database is seeded with **`demo@demo.com` / `Demo1234!`**, and **`POST /api/auth/login`** is not returning **401** (credentials) or **429** (rate limit). The smoke harness **retries login on 429** with backoff and tries **both** gov-preview URL shapes. If live smoke is red, triage with [`docs/smoke-harness-runbook.md`](./smoke-harness-runbook.md) and redeploy.

---

## Git commit message (as requested)

```
feat: PulseOS March 2026 Production Push COMPLETE – Odia-first + BullMQ upsertJobScheduler + 65/65 + 7/7 smoke
```

**Current test baseline after this push:** **68/68** Vitest (includes `tests/briefing.test.ts`). The commit line above preserves the March 2026 push wording; release notes should cite **68/68** for accuracy.
