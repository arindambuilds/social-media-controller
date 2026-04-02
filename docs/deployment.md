## Deployment model (Render)

PulseOS runs as **two services** on Render:

- **API service**: handles HTTP traffic (`/api/*`, `/health`, `/whatsapp/webhook` verification + HMAC, billing webhooks, etc.)
- **Ingress worker service**: runs the WhatsApp ingress worker only (consumes `whatsapp-ingress` queue and enqueues downstream work)

This split avoids coupling inbound webhook reliability to the API process lifecycle, and makes it safe to scale ingress independently.

## Services

### API service

- **Start command**: `npm run start:migrate && npm start`
- **Responsibilities**:
  - Serves all HTTP routes
  - Registers API-side workers that are safe to run in-process (depending on env flags)
  - Exposes `/api/health?deps=1` dependency snapshot used by the smoke harness

### WhatsApp ingress worker service

- **Start command**: `tsx src/workers/whatsappIngressWorkerEntry.ts`
- **Responsibilities**:
  - Runs `startWhatsAppIngressWorker()` exactly once
  - Uses the shared Redis configuration (`REDIS_URL`) for BullMQ
  - Never calls `redis.quit()`/`disconnect()` on the shared client (BullMQ uses dedicated duplicated connections)

## Environment variables

Both services must share the same core env vars:

- `DATABASE_URL` (Supabase transaction pooler `:6543` in production)
- `REDIS_URL`
- `JWT_SECRET` / `JWT_REFRESH_SECRET`
- WhatsApp + Anthropic keys as required

The ingress worker also requires the WhatsApp webhook-related env vars to validate HMAC.

## Operational notes

- **Graceful shutdown**: Render sends `SIGTERM` on deploys; workers should close their BullMQ `Worker` cleanly.
- **Scaling**: prefer scaling the ingress worker separately if inbound load grows.

