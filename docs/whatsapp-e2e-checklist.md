# WhatsApp E2E Sign-off Checklist

## Pre-conditions
- [ ] Render deployment is live and healthy
- [ ] `WA_ACCESS_TOKEN` or `WA_TOKEN`, `WA_PHONE_NUMBER_ID`, and `WEBHOOK_VERIFY_TOKEN` are set in Render (see `src/config/env.ts`; blueprint also lists `WA_ACCESS_TOKEN`)
- [ ] Webhook URL is registered and verified in Meta dashboard

## Webhook route fix (code — verify on Render after deploy)
- [x] `POST /whatsapp/webhook` is mounted with `app.use("/whatsapp/webhook", express.raw(...), webhookLimiter, waWebhookRouter)` so `waWebhookRouter.post("/")` matches (commit `dc411d2` on `main`)

## Render / branch note
This repo has **`main`** (no `production` branch in remotes). If Render deploys from another branch, merge or push the same commit there. If Render already tracks **`main`**, a push to `main` is enough once the service shows **Live**.

## Retest after deploy (live WhatsApp on Render)
- [ ] Render dashboard shows deploy **Live** including commit `dc411d2` (or newer on the branch Render uses)
- [ ] Send from phone: `PulseOS WhatsApp E2E test 7`
- [ ] Logs: `POST /whatsapp/webhook` → **200** (not 404)
- [ ] Logs: webhook handler activity (HMAC, dispatcher, ingress, etc.)
- [ ] Phone: **AI / bot reply** received (not only Meta “Hello World” template samples)

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
