# Email subsystem — PR summary, Render runbook, and launch checklist

This document mirrors the production-grade email rollout for PulseOS (`social-media-controller`). Keep it next to the code when opening a PR or operating Render.

---

## PR description

### Summary

This work finalises the production-grade email subsystem for PulseOS.

### What’s included

- **Multi-provider delivery abstraction**
  - Postmark as primary provider
  - AWS SES as failover provider
- **Queue-first delivery with BullMQ**
  - No synchronous email sends from request handlers
  - Email jobs are enqueued and processed by a worker
- **Idempotency / deduplication**
  - Redis-backed deduplication keys
- **Per-recipient rate limiting**
  - Sliding-window enforcement in Redis
- **Delivery lifecycle logging**
  - `EmailLog` captures queueing, send attempts, provider used, provider message ID, errors, and final status
- **Suppression handling**
  - Bounce / spam complaint webhooks create `EmailSuppression` rows
- **Type-safe template system**
  - Shared base layout
  - Account verification, password reset, login alert, notification, system report, admin alert
- **Operational jobs**
  - Log retention worker (`npm run worker:email:retention`)
  - DLQ monitor worker (`npm run worker:email:dlq`)
- **Quadrapilot integration**
  - Agent-triggered email actions
  - Optional transcript / PDF attachments
  - Recipient resolution from request, JWT user, context extraction, or fallback

### Hardening fixes

- **`emailQueue | null` pattern** — avoids import-time crashes when Redis is absent or intentionally unavailable
- **Lazy provider creation** — API can boot without Postmark / SES credentials; provider failure happens when a real delivery job runs
- **BullMQ `jobId` sanitisation** — removes invalid characters and caps length to avoid BullMQ rejection
- **Embedded worker startup** — `src/server.ts` starts the email worker in production when `START_EMAIL_WORKER_IN_API` is not `false` / `0` (default: embedded when Redis is available)
- **Prisma migration** — adds `EmailLog`, `EmailSuppression`, and `EmailStatus`

### Operational model

- **Queue-only email delivery** — API enqueues jobs; worker performs delivery
- **Provider failover** — Postmark primary; SES secondary when configured
- **Worker modes**
  - Embedded worker in the API service
  - Standalone worker via `node dist/workers/emailWorkerEntry.js` (or `npm run worker:email` in dev)

**Important:** do **not** run embedded and standalone workers together unless you intentionally want multiple consumers on the same queue.

### New / relevant environment variables

**Required (for real delivery)**

- `EMAIL_FROM_ADDRESS` (code defaults to a placeholder when unset — **set a verified sender in production**)
- `POSTMARK_API_TOKEN`  
  **or**
- `EMAIL_PROVIDER=ses` with `AWS_SES_ACCESS_KEY`, `AWS_SES_SECRET_KEY`, `AWS_SES_REGION`
- `REDIS_URL` (non-localhost for BullMQ)

**Recommended / optional**

- `EMAIL_FROM_NAME`
- `EMAIL_REPLY_TO`
- `POSTMARK_WEBHOOK_SECRET`
- `EMAIL_QUEUE_CONCURRENCY`
- `EMAIL_RATE_LIMIT_PER_HOUR`
- `EMAIL_RATE_LIMIT_PER_DAY`
- `EMAIL_DEDUPE_TTL_SECONDS`
- `EMAIL_LOG_RETENTION_DAYS`
- `EMAIL_DLQ_ALERT_THRESHOLD`
- `DEFAULT_ALERT_EMAIL`
- `START_EMAIL_WORKER_IN_API`

### Migration / rollout notes

- Apply Prisma migration before enabling production delivery: `npx prisma migrate deploy`
- Ensure Render environment variables are present before the first real send
- Configure Postmark webhook for bounce, spam complaint, and delivery
- Decide worker topology before deploy: embedded in API **or** standalone worker service

### Breaking changes / deployment impact

- Database migration required before email delivery is enabled
- Email delivery depends on Redis-backed queueing
- If worker mode is misconfigured, jobs may enqueue without being processed
- If both embedded and standalone workers are enabled, both will consume from the same queue

### Reviewer checklist

- [ ] Confirm Prisma migration exists and is correct
- [ ] Review `EmailLog` / `EmailSuppression` schema additions
- [ ] Verify queue-first behavior remains intact
- [ ] Verify provider creation is lazy and API boot is not blocked by missing mail credentials
- [ ] Verify BullMQ `jobId` sanitisation is applied before enqueue
- [ ] Confirm `START_EMAIL_WORKER_IN_API` behavior in `src/server.ts`
- [ ] Validate webhook route and token handling
- [ ] Test one real email send
- [ ] Test one bounce / complaint webhook
- [ ] Confirm `EmailLog` and `EmailSuppression` rows update as expected

---

## Render deployment runbook

### 1. Prerequisites

**Assumptions**

- PostgreSQL exists and is reachable by Prisma
- Redis exists and is reachable by BullMQ
- Render API service exists
- Code is deployed from `main`
- Prisma migration for `EmailLog` / `EmailSuppression` is committed

**You will need**

- Postmark production server token **or** SES credentials
- A verified sender domain / sender identity
- Render access to the API service and optional Background Worker service

### 2. Environment variables (Render API service)

**Postmark primary**

```env
EMAIL_FROM_ADDRESS=noreply@pulseos.in
EMAIL_FROM_NAME=PulseOS
POSTMARK_API_TOKEN=pmk_xxxxx
REDIS_URL=rediss://default:xxxx@host:port
DEFAULT_ALERT_EMAIL=admin@pulseos.in
```

**Optional but recommended**

```env
EMAIL_REPLY_TO=hello@pulseos.in
EMAIL_QUEUE_CONCURRENCY=5
EMAIL_RATE_LIMIT_PER_HOUR=5
EMAIL_RATE_LIMIT_PER_DAY=20
EMAIL_DEDUPE_TTL_SECONDS=3600
EMAIL_LOG_RETENTION_DAYS=90
EMAIL_DLQ_ALERT_THRESHOLD=5
EMAIL_LOGS_ENABLED=true
POSTMARK_WEBHOOK_SECRET=change-me-webhook-token
START_EMAIL_WORKER_IN_API=true
```

**SES failover**

```env
AWS_SES_ACCESS_KEY=AKIA...
AWS_SES_SECRET_KEY=...
AWS_SES_REGION=us-east-1
```

**SES as primary**

```env
EMAIL_PROVIDER=ses
EMAIL_FROM_ADDRESS=noreply@pulseos.in
REDIS_URL=rediss://default:xxxx@host:port
AWS_SES_ACCESS_KEY=AKIA...
AWS_SES_SECRET_KEY=...
AWS_SES_REGION=us-east-1
```

**Notes**

- `EMAIL_DEV_INTERCEPT` must **not** be set in production
- `REDIS_URL` must be a real non-localhost Redis instance
- `EMAIL_FROM_ADDRESS` must match a verified sender/domain in your provider

### 3. Apply the Prisma migration

**If the API start command already runs migrations**

```bash
npx prisma migrate deploy && node dist/server.js
```

**Manual**

```bash
npx prisma migrate deploy
```

**Verify**

After migration: `EmailLog`, `EmailSuppression`, and `EmailStatus` exist. Do **not** enable real sends before migration is applied.

### 4. Choose worker mode

**Option A — Embedded**

```env
START_EMAIL_WORKER_IN_API=true
```

(or omit; default is to embed when Redis is up and the env is not `false`)

- Email worker runs inside the API process
- No separate Render worker service required

**Option B — Standalone**

API:

```env
START_EMAIL_WORKER_IN_API=false
```

Background Worker start command:

```bash
node dist/workers/emailWorkerEntry.js
```

**Warning:** do not run both embedded and standalone unless you want multiple consumers on the `email` queue.

### 5. Postmark webhook

1. In Postmark, open your production server.
2. Webhook URL:

   `https://<your-render-api>/api/webhooks/email/postmark`

3. Enable: Bounce, Spam Complaint, Delivery.

**If `POSTMARK_WEBHOOK_SECRET` is set**

- Render: `POSTMARK_WEBHOOK_SECRET=your-shared-token`
- Postmark must send header: `x-postmark-webhook-token: your-shared-token`

Verify with Postmark’s webhook test: HTTP `200`, no token mismatch in logs.

### 6. First send test (`/api/execute`)

```bash
curl -X POST "https://<your-render-api>/api/execute" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -d '{
    "input": "Send me a summary of this result.",
    "requestEmailOnCompletion": true,
    "recipientEmail": "your@email.com",
    "emailSubject": "PulseOS email system test"
  }'
```

**Expected:** job enqueued → worker sends → `EmailLog` updated → inbox receives mail.

### 7. Verify logs

- **DB:** `EmailLog` shows `QUEUED` → `SENDING` → `SENT` (and optionally `DELIVERED` after webhook); `providerMessageId` and `providerUsed` populated.
- **Render:** API + worker logs; provider failover warnings if applicable.
- **Postmark:** activity matches sends.

### 8. Simulate bounce / complaint

```bash
curl -X POST "https://<your-render-api>/api/webhooks/email/postmark" \
  -H "Content-Type: application/json" \
  -H "x-postmark-webhook-token: <POSTMARK_WEBHOOK_SECRET>" \
  -d '{
    "RecordType": "Bounce",
    "MessageID": "<providerMessageId-from-EmailLog>",
    "Email": "your@email.com",
    "Description": "Hard bounce test",
    "BounceType": "HardBounce"
  }'
```

**Expected:** `200 OK`; `EmailLog.status = BOUNCED`; `EmailSuppression` row for the address.

Spam complaint: use `RecordType: "SpamComplaint"` → expect `SPAM_COMPLAINT` and suppression.

### 9. Monitoring

- **Queue:** BullMQ `email` — waiting / active / failed (e.g. Redis keys `bull:email:*`).
- **DLQ monitor:** `npm run worker:email:dlq` — alerts via `EMAIL_DLQ_ALERT_THRESHOLD` and `DEFAULT_ALERT_EMAIL`.
- **Retention:** `npm run worker:email:retention` — prunes by `EMAIL_LOG_RETENTION_DAYS`.

### 10. Rollback

1. **Stop embedded consumption:** `START_EMAIL_WORKER_IN_API=false`, redeploy API.
2. **Standalone:** scale down or stop the worker service.
3. **Bad credentials:** fix env, redeploy, retry test send.
4. **Webhook:** relax or remove `POSTMARK_WEBHOOK_SECRET` temporarily, or disable webhook in Postmark.
5. **Missed migration:** `npx prisma migrate deploy`.
6. **Redis / queue:** verify `REDIS_URL`, worker logs, and that only intended consumers run.

### Recommended first-production sequence

1. Apply migration  
2. Set env vars  
3. Choose worker mode  
4. Redeploy  
5. Send one real email  
6. Verify `EmailLog`  
7. Simulate bounce webhook  
8. Verify `EmailSuppression`  
9. Enable ongoing monitoring  

---

## Launch-readiness checklist

### Code and configuration

- [ ] `EMAIL_FROM_ADDRESS` set in Render (verified sender)
- [ ] `EMAIL_FROM_NAME` set in Render (recommended)
- [ ] `REDIS_URL` set and not localhost
- [ ] Either `POSTMARK_API_TOKEN` or `EMAIL_PROVIDER=ses` with valid AWS credentials
- [ ] `DEFAULT_ALERT_EMAIL` set for DLQ / admin alerts
- [ ] `POSTMARK_WEBHOOK_SECRET` aligned with Postmark if token verification is on
- [ ] `EMAIL_QUEUE_CONCURRENCY` appropriate for load and plan
- [ ] `EMAIL_RATE_LIMIT_PER_HOUR` / `EMAIL_RATE_LIMIT_PER_DAY` set
- [ ] `EMAIL_DEDUPE_TTL_SECONDS` set
- [ ] `EMAIL_LOG_RETENTION_DAYS` matches policy (default 90)
- [ ] `EMAIL_DLQ_ALERT_THRESHOLD` set
- [ ] `EMAIL_DEV_INTERCEPT` **not** set in production
- [ ] `START_EMAIL_WORKER_IN_API` chosen on purpose (embedded vs standalone)
- [ ] Embedded + standalone workers **not** both enabled unintentionally
- [ ] `npx prisma migrate deploy` applied
- [ ] Email worker running (API logs or worker service logs)

### Provider and deliverability

- [ ] Postmark token is production (not sandbox-only) if using Postmark
- [ ] Sender domain / identity verified (Postmark or SES)
- [ ] SPF / DKIM / DMARC in good shape
- [ ] Optional: mail-tester score check
- [ ] Postmark webhook URL reachable (`200 OK`)

### Functional tests

- [ ] Real send arrives in inbox
- [ ] `EmailLog` shows `SENT` and `providerMessageId`
- [ ] Delivery webhook moves status to `DELIVERED` (if configured)
- [ ] Bounce simulation → `BOUNCED` + suppression
- [ ] Spam complaint simulation → `SPAM_COMPLAINT` + suppression
- [ ] Rate limit: sixth send in an hour to same recipient behaves as designed
- [ ] Dedup: second job with same key within TTL skipped
- [ ] `/api/execute` + `requestEmailOnCompletion=true` sends mail
- [ ] Optional: transcript PDF attachment delivers

### Operational readiness

- [ ] `email` queue has an active consumer (no unbounded backlog)
- [ ] Redis / BullMQ activity looks healthy
- [ ] Worker completion logs visible in Render
- [ ] DLQ monitor job scheduled or runbook documented
- [ ] Retention job scheduled or runbook documented
- [ ] `DEFAULT_ALERT_EMAIL` receives admin alerts when threshold hit
- [ ] Postmark activity monitored

### Rollback and recovery

- [ ] Team can disable embedded worker quickly (`START_EMAIL_WORKER_IN_API=false`)
- [ ] Standalone worker can be stopped independently
- [ ] SES failover verified if configured (e.g. invalid Postmark token → SES succeeds)
- [ ] Team knows how to pause delivery (workers) before credential changes
- [ ] Team knows migration recovery (`prisma migrate deploy`)
- [ ] Team can query `EmailLog` / `EmailSuppression` during incidents

---

*End of document.*
