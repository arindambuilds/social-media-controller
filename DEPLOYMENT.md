# PulseOS — Deployment Guide

## Prerequisites

- **Supabase**: Postgres with transaction pooler URL for `DATABASE_URL` (`:6543`, `?pgbouncer=true`) and direct URL for `DIRECT_URL` (`:5432`) for migrations.
- **Redis**: Non-localhost URL for BullMQ (`REDIS_URL`). Localhost Redis is intentionally ignored by the API so devs do not accidentally point staging at a laptop.
- **Secrets**: `JWT_SECRET`, `JWT_REFRESH_SECRET` (≥32 chars), optional `METRICS_SECRET` for `GET /api/metrics`.

## Render (API)

1. **Build command:** `npm ci && npm run build && npx prisma generate`
2. **Start command:** `npx prisma migrate deploy && node dist/server.js`
3. **Environment:** set all vars from `.env.example` that apply; **never** commit `.env`.
4. **PDF worker:** set `START_PDF_WORKER_IN_API=false` and run a second Render service (or PM2 process) with `node dist/workers/pdfWorkerEntry.js` so Puppeteer/Chromium or Gotenberg does not share the API dyno RSS.
5. **PM2 (optional on VPS):** `npm run build && pm2 start ecosystem.config.cjs` — API cluster + separate PDF workers; see `ecosystem.config.cjs` for `max_memory_restart` / `kill_timeout`.

## Email delivery (BullMQ + Postmark / SES)

- **Queue-first only:** API routes enqueue email jobs; delivery happens in the BullMQ worker. There is no synchronous send path.
- **Redis required:** email queue and worker stay disabled without a non-localhost `REDIS_URL`.
- **Provider config:** set `EMAIL_FROM_ADDRESS` plus either:
  - `POSTMARK_API_TOKEN` for Postmark primary
  - or `EMAIL_PROVIDER=ses` with `AWS_SES_ACCESS_KEY`, `AWS_SES_SECRET_KEY`, `AWS_SES_REGION`
- **Embedded worker mode (default):** in production, the API starts the email worker unless `START_EMAIL_WORKER_IN_API=false`.
- **Standalone worker mode:** set `START_EMAIL_WORKER_IN_API=false` and run `npm run worker:email` on a separate Render worker service.
- **Do not run both unintentionally:** if `START_EMAIL_WORKER_IN_API=true` and a separate `worker:email` service is also running, both processes will consume from the same BullMQ queue. That is valid when intentional, but it doubles worker capacity.
- **Provider failure behavior:** the first real delivery job fails loudly if mail providers are not configured. API boot still succeeds.

### Email webhook

- Postmark webhook route: `POST /api/webhooks/email/postmark`
- When `POSTMARK_WEBHOOK_SECRET` is set, requests must include matching header:
  - `x-postmark-webhook-token: <POSTMARK_WEBHOOK_SECRET>`
- Bounce / spam complaint webhooks update `EmailLog` and add rows to `EmailSuppression`.
- Delivery webhooks update `EmailLog.status` to `DELIVERED`.

### Email maintenance jobs

- Retention: `npm run worker:email:retention`
- DLQ monitor: `npm run worker:email:dlq`
- Default retention: 90 days (`EMAIL_LOG_RETENTION_DAYS`)
- DLQ alert threshold: `EMAIL_DLQ_ALERT_THRESHOLD`
- Default alert recipient: `DEFAULT_ALERT_EMAIL`

## Gotenberg (optional HTML→PDF)

1. Run [Gotenberg](https://gotenberg.dev/) v8+ (e.g. Docker `gotenberg/gotenberg:8`) on a private URL.
2. Set **`GOTENBERG_URL`** (e.g. `https://gotenberg.internal:3000`). When set, the PDF worker uses Gotenberg and does **not** require `PUPPETEER_EXECUTABLE_PATH`.
3. Header/footer templates from Puppeteer are not passed through; keep branding inside the HTML body.

## Morning briefing (BullMQ + Claude + Twilio)

- **Default:** `BRIEFING_DISPATCH_MODE` unset → hourly `:00` Asia/Kolkata repeatable `dispatch-hour` on the `briefing` queue (per-client `briefingHourIst`).
- **09:00 IST only:** set `BRIEFING_DISPATCH_MODE=nine_am_ist` → registers `whatsapp-briefing` queue repeatable at `0 9 * * *` and **skips** hourly dispatch. The API process must run **`startWhatsAppBriefingWorker()`** (included in `server.ts` when Redis + production + this mode).
- Configure `ANTHROPIC_API_KEY`, Twilio WhatsApp vars, and client `whatsappNumber` / `briefingEnabled` in Prisma.

**Deck line + 24–48h rehearsal:** [docs/briefing-9am-ist-rehearsal.md](./docs/briefing-9am-ist-rehearsal.md) — stakeholder wording (“`0 9 * * *` + `Asia/Kolkata`, no UTC math”), code pointers, Bull Board note (not shipped in repo), checklist before/after 9:00 IST.

## Load testing

```bash
export ARTILLERY_BEARER_TOKEN="<JWT>"
export ARTILLERY_PDF_CLIENT_ID=demo-client
npm run loadtest
npm run loadtest:report   # writes packages/artillery/report.json
```

Interpret Artillery summary for p95/error rate against your SLO (e.g. health vs PDF latencies differ).

## Smoke

```bash
npm test
npm run smoke:local
# or remote
npm run smoke:render
```

Remote delivery gate when green: **Smoke test: 7/7 checks (Health, Login, Analytics, AI Insights, Leads, Gov preview, Posts).** (`scripts/smoke-demo.ts`; override with `npm run smoke:render -- --base <api>` or `SMOKE_BASE_URL`.) Do not use legacy **6/6** language.

Operator playbook: **[docs/smoke-harness-runbook.md](./docs/smoke-harness-runbook.md)**. CI: **`deploy.yml`** runs smoke after main; **`.github/workflows/smoke-render-scheduled.yml`** runs every 6h (+ manual) with optional secret **`SMOKE_BASE_URL`**.

## Production API + DB parity

After schema or route changes, follow **[docs/production-parity-runbook.md](./docs/production-parity-runbook.md)** — deploy Render, curl `GET /api/pulse/gov-preview`, confirm **`20260331180000_pioneer_fields`** on the production DB, then paste the canonical parity log line into your operator notes.

## Compliance / PII

- Do not log raw tokens or passwords. JobLog stores queue metadata only (no PDF binaries).
- Use GDPR-oriented retention on `JobLog` and audit tables as your policy requires.
