# PulseOS — Social Media Copilot for Creators & Small Businesses

**Status:** **Production-ready (March 2026)** — live API on Render, gov-facing dashboard on Vercel (`/gov-preview`). Odia-first morning briefings use **`morningBriefing`** in `src/lib/claudeClient.ts` when **`Client.language`** is **`or`** (or alias **`odia`**). BullMQ **9:00 Asia/Kolkata** dispatch uses **`upsertJobScheduler`** id **`whatsapp-briefing-9am-ist`** when **`BRIEFING_DISPATCH_MODE=nine_am_ist`**.

**Live:** API **`https://social-media-controller.onrender.com`** · Dashboard gov preview **`https://pulseos.vercel.app/gov-preview`** (set `NEXT_PUBLIC_API_URL` to the Render origin).

**Smoke test (single source of truth):** 7/7 checks (Health, Login, Analytics, AI Insights, Leads, Gov preview, Posts). `npm run smoke-demo` / `npm run smoke:render` / `npm run smoke:render -- --base https://<api-host>` / `SMOKE_BASE_URL`.

**CI:** `npm run lint` + **`npm test`** → **68/68** Vitest tests (includes Odia **`morningBriefing`** contract tests in `tests/briefing.test.ts`).

**What it is:** An **AI-powered social media copilot** for **Instagram creators and small businesses in India** — handling content, analytics, WhatsApp automation, and growth. Built for **demos, pilots, and early revenue**, not as an all-platform social suite.

**Origin:** Product development from **Bhubaneswar, Odisha** — designed for realistic use by salons, cafés, gyms, boutiques, coaches, and neighbourhood service brands.

---

## Product (one screen)

| For | Promise |
|-----|--------|
| Salon / café / gym owner | “See what’s working on Instagram and what to post next — without a marketing team.” |
| Creator | “Turn your IG data into simple next steps and caption ideas.” |

**In scope (MVP):** Instagram connect (OAuth), ingestion (real or mock), analytics summaries, AI insights, recommendations, captions, dashboard.

**Out of scope (for now):** Full multi-network publishing, ads management, enterprise SSO, mobile apps.

---

## Stack

| Layer | Tech |
|--------|------|
| API | Node.js, Express 5, TypeScript |
| Data | PostgreSQL, Prisma |
| Jobs | Redis (e.g. Upstash), BullMQ |
| Dashboard | Next.js 15 (see `dashboard/`) |

---

## Quick start (Windows-friendly)

Full steps: **[docs/local-dev.md](docs/local-dev.md)** (Postgres local + **Upstash Redis**, no Docker required).

```powershell
copy .env.example .env
# Edit .env:
# - local Postgres: set both DATABASE_URL and DIRECT_URL to localhost:5432
# - Supabase/Render: DIRECT_URL must stay on :5432, DATABASE_URL must use the transaction pooler on :6543
# - also set REDIS_URL, JWT_*, ENCRYPTION_KEY, INGESTION_MODE=mock for demos
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

Terminal 1 — API:

```powershell
npm run dev
```

Terminal 2 — ingestion worker (required for sync jobs):

```powershell
npm run worker
```

Terminal 3 — dashboard:

```powershell
npm run dashboard:dev
```

- API: `http://localhost:4000` · Dashboard: `http://localhost:3000`  
- Internal seeded demo credentials are documented in the operator runbooks only. Keep those docs private to your team.

- Set `NEXT_PUBLIC_API_URL=http://localhost:4000` in `dashboard/.env.local` if needed.

**Mock vs real Instagram:** `INGESTION_MODE=mock` uses synthetic sync (best for investor/mentor demos without Meta app review). `INGESTION_MODE=instagram` uses the Instagram ingestion path when tokens and Graph API access are configured.

---

## Diagnosing login failures

This repo uses two database URLs:
- `DATABASE_URL` — runtime DB the API connects to
- `DIRECT_URL` — DB Prisma runs migrations against

These can point to different servers. If you migrate locally but your dashboard
points to the Render API, login will still fail because the live DB is unmigrated.

**Fast check (30 seconds):**

1. `npm run db:check` — are both URLs on the same latest migration?
2. `cd dashboard && npm run api:check` — is the dashboard pointing where you think?
3. `npm run db:health` — what DB is the local API actually using?

**If `db:check` shows a mismatch:**

Set `DIRECT_URL` to the target database's direct connection string, then run:

```bash
npx prisma migrate deploy
```

**If `api:check` shows dashboard → Render but migrations ran locally:**

You need to run migrations against the Render database, not localhost.

---

## Documentation map

### Customer-shareable docs

| Doc | Purpose |
|-----|---------|
| [docs/customer-shareable-overview.md](docs/customer-shareable-overview.md) | Safe external overview for customers, mentors, or partners |
| [docs/mvp-product.md](docs/mvp-product.md) | Positioning, MVP promise, what to ignore |
| [docs/incubation-readiness.md](docs/incubation-readiness.md) | Metrics, language, pilot evidence (no hype) |
| [docs/mvp-status-one-pager.md](docs/mvp-status-one-pager.md) | Status, investor/pilot outline, Phases 2–3 + GTM |
| [docs/government/](docs/government/README.md) | Grant package: 500-MSME pilot plan, IAS tech summary, ₹25–50L budget split |

### Internal operator docs

| Doc | Purpose |
|-----|---------|
| [GITHUB_SETUP.md](GITHUB_SETUP.md) | Push to GitHub, CI workflow, optional branch protection |
| [SECURITY.md](SECURITY.md) | How to report vulnerabilities; hardening pointers |
| [docs/DEMO.md](docs/DEMO.md) | Internal demo credentials, seeded tenants, and operator flow |
| [docs/local-dev.md](docs/local-dev.md) | Env, migrations, seed, curl checks |
| [docs/deploy-checklist.md](docs/deploy-checklist.md) | Operator-ready Supabase + Render deploy checklist |
| [docs/2-week-plan.md](docs/2-week-plan.md) | Founder-sized execution plan |
| [docs/demo-script.md](docs/demo-script.md) | 8-step live demo story (local business) |
| [docs/launch-checklist.md](docs/launch-checklist.md) | Pre-demo env + smoke + manual pass |
| [docs/cycle3-antigravity-tech-status.md](docs/cycle3-antigravity-tech-status.md) | **Cycle 3 / Antigravity** — Slack/Notion copy: **7/7** Render smoke, **9:00 Asia/Kolkata** cron (`0 9 * * *`, `tz: "Asia/Kolkata"`), **Task 15** Gov preview, migrate wording (Supabase vs laptop) |
| [docs/production-parity-runbook.md](docs/production-parity-runbook.md) | **Render + DB parity** — gov-preview curl, `migrate deploy`, parity log line |
| [docs/vercel-gov-preview-wiring.md](docs/vercel-gov-preview-wiring.md) | **Vercel → Render** — `NEXT_PUBLIC_API_URL`, `/gov-preview`, ISR **3600s** |
| [docs/briefing-9am-ist-rehearsal.md](docs/briefing-9am-ist-rehearsal.md) | **9:00 IST briefings** — `upsertJobScheduler`, deck line, rehearsal |
| [docs/gov-demo.md](docs/gov-demo.md) | **Gov / Startup Odisha** — live URLs, `/gov-preview`, production status |
| [docs/PRODUCTION-READY-DELIVERABLES.md](docs/PRODUCTION-READY-DELIVERABLES.md) | **31 Mar 2026** deliverables pack (demo script, pilot blurb, QuadraPilot) |
| [docs/stripe-pioneer-plan.md](docs/stripe-pioneer-plan.md) | **Stripe Pioneer ₹600/mo** — `STRIPE_PRICE_PIONEER600_INR`, `src/config/stripe.ts`, checkout |
| [docs/odia-demo-sanity-check.md](docs/odia-demo-sanity-check.md) | **Odia-first** — prompts, WhatsApp rehearsal, proof assets |
| [docs/final-demo-hardening.md](docs/final-demo-hardening.md) | **Last 24h** — E2E, freeze list, narratives for gov vs angels |
| [docs/smoke-harness-runbook.md](docs/smoke-harness-runbook.md) | **Smoke 7/7** — local vs Render URLs, triage, CI, Slack one-liner |
| [docs/completion-report.md](docs/completion-report.md) | Endpoints, workers, founder Done / next (repo-aligned) |
| [docs/implementation-roadmap.md](docs/implementation-roadmap.md) | Longer-term phases |
| [docs/pilot-operational-readiness.md](docs/pilot-operational-readiness.md) | Evidence vs narrative: tenant isolation, OAuth/Redis, gov-facing discipline |
| [docs/production-verification-checklist.md](docs/production-verification-checklist.md) | Internal production smoke and seeded login verification |
| [docs/email-production-runbook.md](docs/email-production-runbook.md) | Internal email rollout and Render runbook |

---

## API surface (high level)

| Area | Endpoints (representative) |
|------|----------------------------|
| **Auth** | `POST /api/auth/signup`, `login`, `refresh`, `GET /api/auth/me`, `register` (agency) |
| **Instagram OAuth** | `GET /api/auth/oauth/instagram/authorise`, callbacks, `social-accounts/connect/*` |
| **Analytics** | `GET /api/analytics/:clientId/overview`, `posts`, `GET /api/analytics/:platform/:clientId/summary` |
| **AI / insights** | `GET/POST /api/ai/*`, `GET /api/insights/*`, `POST /api/ai/insights/*` |
| **Billing** | `GET /api/billing/:clientId/status` |
| **Clients & DM** | `GET/PATCH /api/clients/:clientId/dm-settings`, `GET /api/clients/:clientId/dm-conversations`, `GET .../dm-conversations/:id/messages` |
| **Meta DM webhook** | `GET/POST /api/webhook/instagram` (verify token + `X-Hub-Signature-256`; no JWT) |
| **Ingestion webhooks** | `POST /api/webhooks/*` (signed) |
| **Morning briefing** | `GET /api/briefing/latest`, `POST /api/briefing/trigger`, `PATCH /api/briefing/settings` |
| **Voice-to-post** | `POST /api/voice/transcribe`, `POST /api/voice/generate`, `POST /api/voice/save` |
| **Posts / leads / accounts** | `GET/POST/DELETE /api/posts`, `GET /api/leads`, `GET/POST /api/social-accounts/*` |

See `docs/completion-report.md` for a fuller route table.

---

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | API dev |
| `npm run worker` | Ingestion worker |
| `npm run build` | Compile API |
| `npm run lint` | Typecheck API |
| `npm run prisma:seed` | Seed demo data |
| `npm run prisma:deploy` | Run production migrations using `DIRECT_URL` |
| `npm run dashboard:build` | Production build of dashboard |
| `npm run smoke-demo` / `npm run smoke:demo` | Configurable URL smoke (`scripts/smoke-demo.ts`) |
| `npm run smoke:render` | **7/7** vs default Render URL; `-- --base <url>` or `SMOKE_BASE_URL` for another API |
| `npm run pdf:mvp-one-pager` | Build `docs/mvp-status-one-pager.pdf` from the Markdown (uses Microsoft Edge) |
| `npm test` | Vitest API smoke (needs `DATABASE_URL`; `REDIS_URL` optional — OAuth state falls back to memory) |
| `npm run verify` | `lint` + `test` + `dashboard:build` (release gate before deploy; same steps as [CI](.github/workflows/ci.yml)) |

---

## Security

- **Reporting:** see [SECURITY.md](SECURITY.md).  
- JWT for API auth; refresh tokens supported; optional httpOnly cookies via `AUTH_HTTPONLY_COOKIES` (`.env.example`).  
- OAuth `state` stored in Redis when configured; otherwise in-memory (single-instance).  
- Social tokens encrypted at rest (see `src/lib/encryption.ts`).  
- Role checks on agency-only routes.  
- Inbound social webhooks require HMAC SHA-256 signing via `WEBHOOK_SIGNING_SECRET`.

### Webhook signature contract

- Send the exact raw JSON body bytes signed with HMAC SHA-256 using `WEBHOOK_SIGNING_SECRET`.
- Supported headers:
  - `X-Webhook-Signature: <hex digest>`
  - `X-Hub-Signature-256: sha256=<hex digest>`
- Unsigned webhook writes are rejected.

--- 

## Licence

Private / use per your team policy.
