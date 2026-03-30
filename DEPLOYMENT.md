# PulseOS / IGC API — deployment (Render + Supabase)

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

## Gotenberg (optional HTML→PDF)

1. Run [Gotenberg](https://gotenberg.dev/) v8+ (e.g. Docker `gotenberg/gotenberg:8`) on a private URL.
2. Set **`GOTENBERG_URL`** (e.g. `https://gotenberg.internal:3000`). When set, the PDF worker uses Gotenberg and does **not** require `PUPPETEER_EXECUTABLE_PATH`.
3. Header/footer templates from Puppeteer are not passed through; keep branding inside the HTML body.

## Morning briefing (BullMQ + Claude + Twilio)

- **Default:** `BRIEFING_DISPATCH_MODE` unset → hourly `:00` Asia/Kolkata repeatable `dispatch-hour` on the `briefing` queue (per-client `briefingHourIst`).
- **09:00 IST only:** set `BRIEFING_DISPATCH_MODE=nine_am_ist` → registers `whatsapp-briefing` queue repeatable at `0 9 * * *` and **skips** hourly dispatch. The API process must run **`startWhatsAppBriefingWorker()`** (included in `server.ts` when Redis + production + this mode).
- Configure `ANTHROPIC_API_KEY`, Twilio WhatsApp vars, and client `whatsappNumber` / `briefingEnabled` in Prisma.

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

## Compliance / PII

- Do not log raw tokens or passwords. JobLog stores queue metadata only (no PDF binaries).
- Use GDPR-oriented retention on `JobLog` and audit tables as your policy requires.
