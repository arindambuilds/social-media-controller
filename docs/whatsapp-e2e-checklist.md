# WhatsApp E2E Sign-off Checklist

## Pre-conditions
- [ ] Render deployment is live and healthy
- [ ] WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID are set in Render dashboard
- [ ] Webhook URL is registered and verified in Meta dashboard

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
