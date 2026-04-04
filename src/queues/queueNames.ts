export const queueNames = {
  email: "email",
  ingestion: "ingestion",
  tokenRefresh: "token-refresh",
  postPublish: "post-publish",
  briefing: "briefing",
  /** Daily 09:00 IST dispatcher when `BRIEFING_DISPATCH_MODE=nine_am_ist` (same processor as briefing tick). */
  whatsappBriefing: "whatsapp-briefing",
  /** Twilio-only delivery of pre-rendered briefing text (no Claude in worker). */
  whatsappSend: "whatsapp-send",
  maintenance: "maintenance",
  /** HTML→PDF (Puppeteer or Gotenberg); worker concurrency 3. */
  pdfGenerate: "pdf-generate",
  /** Meta WhatsApp Cloud ingress (session + metrics). */
  whatsappIngress: "whatsapp-ingress",
  /** Meta WhatsApp Cloud outbound Graph sends. */
  whatsappOutbound: "whatsapp-outbound"
} as const;
