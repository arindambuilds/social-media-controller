# WhatsApp E2E Sign-off Checklist

## Pre-conditions
- [ ] Render deployment is live and healthy
- [ ] `WA_ACCESS_TOKEN` or `WA_TOKEN`, `WA_PHONE_NUMBER_ID`, and `WEBHOOK_VERIFY_TOKEN` are set in Render (see `src/config/env.ts`; blueprint also lists `WA_ACCESS_TOKEN`)
- [ ] Webhook URL is registered and verified in Meta dashboard

## Webhook route fix (code — verify on Render after deploy)
- [x] `POST /whatsapp/webhook` is mounted with `app.use("/whatsapp/webhook", express.raw(...), webhookLimiter, waWebhookRouter)` so `waWebhookRouter.post("/")` matches (commit `dc411d2` on `main`)

## Render / branch note
This repo has **`main`** (no `production` branch in remotes). If Render deploys from another branch, merge or push the same commit there. If Render already tracks **`main`**, a push to `main` is enough once the service shows **Live**.

## Final gate — 3-step E2E (after latest `main` is Live on Render)

Run these in order; tick each only when observed.

### Step 1 — Send (fresh phrase)
- [ ] From the **WhatsApp user linked to your Cloud API app**, send: **`PulseOS WhatsApp E2E test 9`** (increment `N` each run so logs are grep-friendly)

### Step 2 — Render logs (API + workers)
- [ ] **API** access log: `POST /whatsapp/webhook` → **200** (not **404** or **403**)
- [ ] **Webhook path**: HMAC + parse + dispatcher activity (e.g. `[whatsapp webhook]`, dispatch / normalise)
- [ ] **Ingress worker** (`pulse-whatsapp-ingress-worker` or equivalent): job processed for `whatsapp-ingress` (e.g. ingress processed / session update)
- [ ] **Agent enqueue**: `wa_reply_enqueued` (or explicit skip logs: window expired, queue unavailable, generation failed)
- [ ] **Outbound worker** (`pulse-whatsapp-outbound-worker` or equivalent): send attempt / Graph success with a **`wamid.`** id (or documented template path if outside 24h)

### Step 3 — Phone
- [ ] Within ~**30s**, receive a **short text reply from PulseOS** (your agent), **not** only Meta’s “Hello World” / sample **template** push

**24h window (code):** last inbound timestamp is stored in Redis under **`pulse:wa:last_inbound:{waId}`** (48h TTL); agent reply path checks **≤ 86400s** since that timestamp.

## Retest after deploy (summary checklist)
- [ ] Render **Live** on commit **`dc411d2`** or newer (ideally **`e119a91`**+ on `main`)
- [ ] All three steps above **checked**

## Test Steps
- [ ] Send a WhatsApp message to the bot number
- [ ] Confirm message appears in Render logs (grep: "Incoming:")
- [ ] Confirm bot reply is received on the phone within 10 seconds
- [ ] Confirm reply content is not empty or undefined
- [ ] Confirm no 500 errors in Render logs during the exchange

## Sign-off
- Tested by: _______________
- Date: _______________
- Render log URL: _______________
- Result: PASS / FAIL
