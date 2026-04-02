/**
 * Artillery processor: build compact JSON body + HMAC-SHA256 (x-hub-signature-256).
 * Set WA_APP_SECRET in the environment before `artillery run`.
 */
const crypto = require("node:crypto");

function beforeRequest(requestParams, _context, _ee, next) {
  const secret = process.env.WA_APP_SECRET?.trim();
  if (!secret) {
    return next(new Error("WA_APP_SECRET is required for signed POST scenarios"));
  }
  const id = `wamid.${Date.now()}.${Math.random().toString(36).slice(2, 12)}`;
  const raw = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: "123456789012345" },
              contacts: [{ wa_id: "15551234567", profile: { name: "LoadTest" } }],
              messages: [
                {
                  from: "15551234567",
                  id,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "text",
                  text: { body: "loadtest ping" }
                }
              ]
            }
          }
        ]
      }
    ]
  });
  requestParams.body = raw;
  requestParams.headers = requestParams.headers || {};
  requestParams.headers["Content-Type"] = "application/json";
  const h = crypto.createHmac("sha256", secret).update(raw, "utf8").digest("hex");
  requestParams.headers["x-hub-signature-256"] = `sha256=${h}`;
  next();
}

module.exports = { beforeRequest };
