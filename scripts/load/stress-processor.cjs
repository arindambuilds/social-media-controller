/**
 * Artillery processor hooks — referenced from stress-test.yml `config.processor`.
 */
function prepareAnalyticsPayload(context, _events, done) {
  context.vars.sessionId = `stress-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  context.vars.ts = Date.now();
  done();
}

/** Set `Authorization: Bearer …` when `ARTILLERY_BEARER_TOKEN` is in the environment. */
function attachBearerIfPresent(context, _events, done) {
  const t = process.env.ARTILLERY_BEARER_TOKEN;
  if (t) {
    context.vars.authHeader = `Bearer ${t}`;
  }
  done();
}

function preparePdfStress(context, _events, done) {
  const t = process.env.ARTILLERY_BEARER_TOKEN;
  context.vars.authHeader = t ? `Bearer ${t}` : "";
  context.vars.pdfClientId = process.env.ARTILLERY_PDF_CLIENT_ID || "demo-client";
  done();
}

/** Soak mix: bearer + client ids for PDF + analytics scenarios. */
function prepareSoakAuth(context, _events, done) {
  const t = process.env.ARTILLERY_BEARER_TOKEN;
  context.vars.authHeader = t ? `Bearer ${t}` : "";
  context.vars.pdfClientId = process.env.ARTILLERY_PDF_CLIENT_ID || "demo-client";
  context.vars.analyticsClientId =
    process.env.ARTILLERY_ANALYTICS_CLIENT_ID || context.vars.pdfClientId || "demo-client";
  done();
}

module.exports = {
  prepareAnalyticsPayload,
  attachBearerIfPresent,
  preparePdfStress,
  prepareSoakAuth
};
