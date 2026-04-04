## Deployment model (Render)

PulseOS runs as **three services** on Render for full Meta WhatsApp (ingress + replies):

- **API service**: HTTP (`/api/*`, `/health`, `/whatsapp/webhook`, billing, etc.)
- **WhatsApp ingress worker**: consumes `whatsapp-ingress` only
- **WhatsApp outbound worker**: consumes `whatsapp-outbound` and calls the Graph API (replies)

The API **embeds** the Meta outbound worker by default (`START_WA_OUTBOUND_WORKER_IN_API` defaults to `true`). If you set `START_WA_OUTBOUND_WORKER_IN_API=false` on the API (to isolate send load), you **must** run the dedicated outbound worker or **no replies will be sent**.

## Services

### API service

- **Start command**: `npm run start:migrate && npm start` (or `node dist/server.js` per `render.yaml`)
- **Responsibilities**:
  - Serves all HTTP routes
  - In production with Redis: calls `startWhatsAppOutboundWorker()` in-process **unless** `START_WA_OUTBOUND_WORKER_IN_API` is `false` or `0`
  - Other embedded workers depend on env (PDF, etc.)
  - Exposes `/api/health?deps=1` dependency snapshot used by the smoke harness

### WhatsApp ingress worker service

- **Start command** (production): `node dist/workers/whatsappIngressWorkerEntry.js`
- **Responsibilities**:
  - Runs `startWhatsAppIngressWorker()` exactly once
  - Uses the shared Redis configuration (`REDIS_URL`) for BullMQ
  - Never calls `redis.quit()`/`disconnect()` on the shared client (BullMQ uses dedicated duplicated connections)

### WhatsApp outbound worker service (required if outbound is not embedded in API)

- **Blueprint name**: `pulse-whatsapp-outbound-worker` (`render.yaml`)
- **Start command**: `node dist/workers/whatsappOutboundWorkerEntry.js` (same as `npm run worker:wa:outbound` after `npm run build`)
- **Responsibilities**:
  - Runs `startWhatsAppOutboundWorker()` and processes jobs on queue `whatsapp-outbound`
- **Logs to confirm**:
  - `WhatsApp outbound worker started` (from `whatsappOutboundWorker.ts`)
  - `Standalone WhatsApp outbound worker process running.` (from `whatsappOutboundWorkerEntry.ts`)
  - Send attempts from `whatsappCloudApiSender` (success / error with Graph details)

## Environment variables

All services that touch WhatsApp + queues must share the same core env vars:

- `DATABASE_URL` (Supabase transaction pooler `:6543` in production)
- `REDIS_URL`
- `JWT_SECRET` / `JWT_REFRESH_SECRET`
- WhatsApp + Anthropic keys as required

The ingress worker requires WhatsApp webhook-related env vars to validate HMAC. The outbound worker needs **`WA_ACCESS_TOKEN`**, **`WA_PHONE_NUMBER_ID`**, and the same **`REDIS_URL`** as the API so it drains the same `whatsapp-outbound` queue.

## Operational notes

- **Graceful shutdown**: Render sends `SIGTERM` on deploys; workers should close their BullMQ `Worker` cleanly.
- **Scaling**: scale ingress separately if inbound load grows; outbound concurrency is capped in code (Graph limits).
- **No replies but ingress OK**: check API logs for `In-process Meta WhatsApp outbound worker disabled` or `outbound worker did not start`, or confirm the `pulse-whatsapp-outbound-worker` service is **not** suspended and uses the **same `main` branch** and **`REDIS_URL`** as the API.

