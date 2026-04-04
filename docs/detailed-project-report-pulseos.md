# PulseOS — Detailed Project Report (DPR)

**Product:** PulseOS  
**Primary backend service:** `social-media-controller` (Node.js / TypeScript, Express)  
**Typical hosting:** Render (web + optional background workers)  
**Document purpose:** Single source of truth for leadership, founders, and onboarding engineers.  
**Last updated:** April 2026 (reflects `main` branch capabilities and recent WhatsApp hardening).

---

## 1. Executive Summary

**PulseOS** is a production-oriented backend platform that orchestrates social and messaging workflows, exposes HTTP APIs for dashboards and agents, and integrates **Meta WhatsApp Cloud API** for conversational experiences. The core implementation lives in the **`social-media-controller`** repository: a TypeScript service using **Prisma** for persistence, **Redis + BullMQ** for durable queues, and structured logging and metrics for operations.

To date, the team has delivered a **technically strong, demo-ready** system: strict typing, a maintained test suite, JWT auth with refresh rotation, rate limiting on sensitive routes, a multi-stage **Quadrapilot** orchestration path, PDF generation pipelines, scheduled jobs, and a **full WhatsApp path** from webhook verification through ingress processing, agent reply dispatch, and Graph API outbound sends. Ingress and queue wiring have been validated in live environments (e.g. `whatsapp_ingress_inbound` and `whatsapp_ingress_dispatch` with `queued_in_window`).

**Current readiness:** the backend pipeline is **architecturally ready** for limited beta use, subject to **configuration parity** (same `REDIS_URL` across API and workers, correct Meta credentials) and **live smoke verification**. The **primary external blocker** for customer-visible WhatsApp replies in some accounts is **Meta Business / WhatsApp billing**: when the Cloud API account shows a missing or invalid payment method, free-tier rules can prevent the business from initiating conversations, which surfaces as “no reply” on the phone even when the application stack is healthy. That constraint is **outside the codebase** and must be resolved in Meta Business Manager.

---

## 2. System Overview

### 2.1 High-level architecture

- **HTTP API (Express):** Public and authenticated routes under `/api/*`, dedicated **WhatsApp** routes under `/whatsapp/webhook`, health endpoints (`/health`, `/api/health`, and related probes), billing webhooks, and static/upload paths as configured.
- **Data layer:** **PostgreSQL** via **Prisma**; migrations are part of the delivery process.
- **Cache / queues:** **Redis** for BullMQ queues, session keys, rate-limit backing where applicable, and WhatsApp session / 24h window state.
- **Workers:** BullMQ **Worker** instances consume named queues. Some workers run **inside the API process** in production when Redis is available and flags allow it; others are intended to run as **separate Render worker services** for isolation (notably WhatsApp ingress; optionally Meta outbound).

### 2.2 Representative API surface (agent / copilot)

Mounted under the API router (e.g. `/api` prefix in production layout):

| Area | Route (conceptual) | Role |
|------|--------------------|------|
| Liveness / branding | `GET /api` | Plain-text readiness line for Quadrapilot clients |
| Full trace | `POST /api/execute` | Runs orchestrator with **metadata** (stages, timings, errors) |
| Lightweight reply | `POST /api/message` | Same orchestrator, minimal response shape |
| Platform webhooks | `POST /api/webhooks` (and related) | Signed / structured ingestion for connected channels |
| Instagram | `POST /api/webhook/instagram` | Raw-body path for Instagram webhook verification / payload |

WhatsApp Cloud API is **not** under `/api`; it uses **`GET` / `POST /whatsapp/webhook`** with **`express.raw`** ahead of signature verification, plus rate limiting on POST.

### 2.3 Queue and worker map (non-exhaustive)

| Queue (name) | Typical role |
|--------------|----------------|
| `whatsapp-ingress` | Normalise inbound Cloud API payloads, update sessions, dispatch agent replies |
| `whatsapp-outbound` | Meta Graph sends (text / template paths) via `whatsappCloudApiSender` |
| `whatsapp-send` | Separate send path (e.g. Twilio-oriented executor) run by WhatsApp send worker |
| PDF / briefing / maintenance | Report generation, scheduled briefings, housekeeping |

**Production boot (`src/server.ts`):** when `NODE_ENV === "production"` and Redis is configured, the service starts embedded workers such as **briefing**, **PDF** (unless disabled), **maintenance**, **WhatsApp send**, and **Meta WhatsApp outbound** (unless `START_WA_OUTBOUND_WORKER_IN_API` is `false`). **Ingress** is commonly run as a **dedicated process** (`whatsappIngressWorkerEntry`) so webhook handling stays decoupled from long-running ingress jobs.

### 2.4 Quadrapilot / multi-agent integration

The **orchestrator** (`src/agents/orchestrator.ts`) drives an external **Quadrapilot** pipeline (stages reflected in generated report artifacts under `quadrapilot/output`). **`POST /api/execute`** and **`POST /api/message`** both invoke this path, with `/execute` returning richer **metadata** (stage list, per-stage timings, collected errors). Routing and depth are influenced by **keyword / intent** handling in the broader agent design (analyse → research → generate → review style flow).

### 2.5 Analytics and metrics

Operational visibility includes Redis-backed counters and structured logs, for example:

- **Redis memory / stream length** style probes where implemented in health and admin paths.
- **Queue depth / priority** signals for PDF and related pipelines.
- **WhatsApp:** `whatsapp_ingress_inbound`, `whatsapp_ingress_dispatch` (with `kind`, e.g. `queued_in_window`), `whatsapp_ingress_processed`, outbound **`wa.metric`** events (`whatsapp_outbound_sent`, `whatsapp_outbound_failed`, `whatsapp_outbound_dlq`, `whatsapp_24h_violation`), and dispatcher logs such as **`wa_reply_enqueued`** / **`wa_reply_window_expired`**.

### 2.6 Other capabilities

- **PDF exports** via Puppeteer (and related circuit-breaking), with optional isolation via `START_PDF_WORKER_IN_API=false` and a dedicated PDF worker entrypoint.
- **Cron-style jobs:** database cleanup, morning briefing scheduling, gov metrics refresh, and related maintenance registered from the app/server lifecycle.

---

## 3. Work Completed to Date

Work is grouped thematically; order is approximate.

### 3.1 Schema, API, and platform foundations

- **Prisma** schema and **migrations** maintained; `prisma generate` integrated into build.
- **Express** application composition in `src/app.ts`: security headers (**Helmet**), **CORS** (no wildcard in production per env validation), **cookie** parsing, **Morgan** logging to structured logger, **global API rate limiter**, and ordered middleware for webhooks (raw body before JSON for HMAC routes).
- **JWT** access tokens (~15m) with **refresh token** flow and rotation; revocation tracking where implemented.
- **Auth, billing, analytics, reports, clients, Instagram OAuth**, and other domain routers wired under `/api`.

### 3.2 Quadrapilot / agent integration

- **`/api/execute`** and **`/api/message`** connected to **`runOrchestrator`**, enabling demos and integrations without duplicating agent logic.
- Stage timing and error capture exposed in execute responses for observability and product storytelling.

### 3.3 Webhook orchestration and WhatsApp ingress

- **Meta webhook verification** on `GET /whatsapp/webhook` using `WEBHOOK_VERIFY_TOKEN`.
- **POST /whatsapp/webhook** mounted with **`app.use`** + **`express.raw`** + rate limiter + router so the POST path matches correctly in production (avoids subtle `app.post` + sub-router path bugs that produced **404** on live POSTs).
- **Normalisation:** `normaliseWhatsAppCloudWebhook` → internal **`PulseNormalisedWhatsAppMessage`**; helpers to rebuild minimal bodies for consistency.
- **Session layer:** Redis-backed session updates and context retrieval before dispatching replies.
- **Metrics:** inbound and dispatch counters for ingress funnel visibility.

### 3.4 Queues, Redis, and worker wiring

- **BullMQ** queues and workers for ingress, outbound, send, PDF, briefing, and maintenance.
- **Render blueprint** (`render.yaml`): **web** service (`pulse-api`), **ingress worker** (`pulse-whatsapp-ingress-worker`), **outbound worker** (`pulse-whatsapp-outbound-worker`) — all must share the **same `REDIS_URL`** and compatible code revision.
- **Operational docs:** `docs/deployment.md` describes the three-service model, `START_WA_OUTBOUND_WORKER_IN_API`, and start commands; `docs/whatsapp-e2e-checklist.md` defines the human E2E gate.

### 3.5 Security, quality, and hygiene audits

- **TypeScript strict** compilation; **ESLint** clean in CI expectations.
- **Rate limiting** on login and webhook surfaces; **HMAC / raw body ordering** verified for WhatsApp (and Instagram raw route).
- **Secrets:** no real credentials in source; env-driven configuration via `src/config/env.ts`.
- **TODO/FIXME** in `src` kept at zero as a hygiene target.

### 3.6 WhatsApp production hardening (see Section 4)

- **BullMQ custom job ID** sanitisation (no `:` in job IDs).
- **Dispatcher** logging for 24h window violations.
- **Graph sender** behaviour for Meta error codes (rate limit retry, template required, unreachable recipient with pause key) plus **structured send logs** (`[whatsappCloudApiSender] Graph send attempt` / `Graph send ok`).
- **`npm run worker:wa:outbound`** alias for the compiled outbound entrypoint.

---

## 4. WhatsApp Production Readiness Hardening

### 4.1 Problems observed

| Symptom | Impact |
|---------|--------|
| **404 on POST /whatsapp/webhook** | Meta delivers events but the API never processes them |
| **Ingress queue add failure: “Custom Id cannot contain :”** | Jobs never enter `whatsapp-ingress`; no downstream reply |
| **No outbound / Graph logs** | Replies stuck if outbound worker not running, wrong Redis, or outbound disabled in API without a separate worker |
| **Opaque “no reply”** | Hard to tell **application** vs **Meta policy / billing** vs **24h window** |

### 4.2 Fixes implemented

1. **Webhook routing (production 404)**  
   - **Fix:** Mount WhatsApp webhook with **`app.use("/whatsapp/webhook", express.raw(...), webhookLimiter, router)`** so `router.post("/")` receives POST correctly.  
   - **Doc tie-in:** `docs/whatsapp-e2e-checklist.md` references commit **`dc411d2`** as the baseline that removes POST 404 regressions.

2. **BullMQ job IDs**  
   - **Cause:** Custom `jobId` included `sessionId` values like `wa:sess:{waId}`, introducing **`:`**, which BullMQ rejects.  
   - **Fix:** Deterministic `jobIdFor()` with **colon replacement** and length cap (≤ 128 chars).  
   - **Result:** Ingress enqueue succeeds; ingress worker consumes jobs reliably.

3. **Outbound worker operability**  
   - **Default:** `START_WA_OUTBOUND_WORKER_IN_API` defaults to **on**; API calls **`startWhatsAppOutboundWorker()`** in production when Redis is up.  
   - **Split mode:** Set env to `false` on API and run **`node dist/workers/whatsappOutboundWorkerEntry.js`** (or **`npm run worker:wa:outbound`**) on a worker dyno with the **same `REDIS_URL`**.  
   - **Logs:** `WhatsApp outbound worker started` (queue `whatsapp-outbound`); standalone entry logs `Standalone WhatsApp outbound worker process running.`

4. **Observability**  
   - **Dispatcher:** **`wa_reply_window_expired`** (with `waId`, `ageSec` or reason) when the 24h customer-care window blocks enqueue; **`wa_reply_enqueued`** on successful queue add.  
   - **Metrics:** **`wa.metric`** events for outbound send, failure (optional `errorCode`), DLQ, and **`whatsapp_24h_violation`** when the Graph path detects policy violations.  
   - **Sender:** Explicit **Graph attempt / success** log lines for grep-friendly production debugging.

### 4.3 Expected behaviour in staging / production

- **Happy path:** Webhook **200** → ingress metric increments → dispatch **`queued_in_window`** → **`wa_reply_enqueued`** → outbound worker → **`[whatsappCloudApiSender] Graph send attempt`** → **`Graph send ok`** with a **`wamid.`** id in the Graph response body.  
- **24h window:** Dispatcher may skip enqueue with **`wa_reply_window_expired`**; Graph may return template-required paths recorded via metrics and return statuses in code.

### 4.4 Remaining external dependencies (Meta)

- **Payment method / billing state** in Meta Business Manager can block **business-initiated** messaging and affect perceived “bot silence” even when the stack is correct. Operators should reconcile Meta dashboard messaging with application logs.  
- **Template approval, phone number quality, and rate limits** remain standard WhatsApp Cloud API operational concerns.

---

## 5. Testing, Quality, and Risk Assessment

### 5.1 Automated tests

- **Vitest** suite: on last full run, **26** test files, **108** tests, **all passing**.  
- Some tests **skip or degrade gracefully** when optional dependencies (e.g. database) are absent; this is acceptable for local contributor machines but **CI / deploy pipelines should run with DB and Redis** where integration coverage matters.

### 5.2 Static analysis and audits

- **TypeScript strict:** expected clean.  
- **ESLint:** enforced via `npm run lint`.  
- **Prisma:** migrations applied in deploy scripts as configured (`start:migrate` patterns on Render).  
- **Security checklist items:** JWT, CORS, rate limits, webhook HMAC ordering — verified as part of hardening narratives and tests where applicable.

### 5.3 Known warnings and minor technical debt

- Some **queue-related tests** run ~1–2s (timeout tuning optional).  
- **Node deprecation warnings** (e.g. `DEP0169`) may still appear at runtime depending on Node version — track upgrades.  
- **depcheck** may flag **unused dependencies** (e.g. historical `bcryptjs`); safe cleanup is periodic hygiene.  
- **Render / production env vars** cannot be fully validated locally; **dashboard review** remains mandatory.

### 5.4 Key risks and mitigations

| Risk | Mitigation |
|------|------------|
| **Worker / API Redis mismatch** | Single `REDIS_URL` across all services; document in deployment runbooks |
| **Outbound worker accidentally off** | Default embed in API; loud logs when disabled or failed to start; dedicated worker in `render.yaml` |
| **Meta policy / billing** | Treat as external; use E2E checklist + Meta dashboard |
| **24h window confusion** | Dispatcher + metric logs explain skip vs send |

---

## 6. Deployment and Operations

### 6.1 Render layout (reference)

- **Web service:** e.g. `pulse-api` or legacy name `social-media-controller` — **`node dist/server.js`** (often preceded by migrations per service command).  
- **Branch:** **`main`** is the hardened line; avoid drifting workers on stale branches.  
- **Workers:** **Ingress** — `node dist/workers/whatsappIngressWorkerEntry.js`; **Outbound** — `node dist/workers/whatsappOutboundWorkerEntry.js` (or `npm run worker:wa:outbound`).  
- **Blueprint:** `render.yaml` encodes the three-service pattern; dashboard may override names.

### 6.2 New environment checklist (operator)

1. Create **PostgreSQL** and **Redis**; set **`DATABASE_URL`**, **`REDIS_URL`**, **`DIRECT_URL`** as required by Prisma.  
2. Set **JWT** secrets and **CORS** origins for real frontends.  
3. Configure **WhatsApp** vars: `WA_ACCESS_TOKEN` / `WA_TOKEN`, `WA_PHONE_NUMBER_ID`, `WA_APP_SECRET`, `WEBHOOK_VERIFY_TOKEN`, etc. (see `src/config/env.ts`).  
4. Deploy **API** + **ingress worker** + (**outbound worker** *or* ensure outbound embedded on API).  
5. Register webhook URL in Meta; run **`docs/whatsapp-e2e-checklist.md`** three-step gate.  
6. Run **`npm test`** (and lint) before promoting builds.

### 6.3 Important environment variables

| Variable | Notes |
|----------|--------|
| `REDIS_URL` | **Must match** across API and all BullMQ workers |
| `START_WA_OUTBOUND_WORKER_IN_API` | Default **on**; set `false` only if a dedicated outbound worker runs |
| `START_PDF_WORKER_IN_API` | `false` to isolate Puppeteer to a PDF worker dyno |
| WhatsApp tokens / phone ID / app secret | Required for verify, HMAC, and Graph sends |
| `NODE_ENV` | `production` on Render |

---

## 7. Next Steps and Recommendations

### 7.1 From demo-ready to production-live

1. **Resolve Meta Business billing / payment method** and confirm messaging tier rules for the WABA.  
2. **Run the live 3-step WhatsApp E2E** (`docs/whatsapp-e2e-checklist.md`) after each material deploy; archive log snippets for audit.  
3. **Add dashboards / alerts** on `wa.metric` counters and queue depths (Redis or external APM).  
4. **Scale workers** independently if ingress or outbound throughput becomes constrained (respect Meta rate limits).

### 7.2 Engineering follow-ups

- Tune slow tests and silence or fix **Node deprecation** warnings on the runtime version pinned in production.  
- Prune **unused dependencies** after a quick usage audit.  
- Optionally consolidate **`docs/deploy-checklist.md`**, **`docs/deployment.md`**, and **`whatsapp-e2e-checklist.md`** cross-links so operators have one entrypoint page.

---

*End of DPR.*
