export const queueNames = {
  ingestion: "ingestion",
  tokenRefresh: "token-refresh",
  postPublish: "post-publish",
  briefing: "briefing",
  /** Daily 09:00 IST dispatcher when `BRIEFING_DISPATCH_MODE=nine_am_ist` (same processor as briefing tick). */
  whatsappBriefing: "whatsapp-briefing",
  maintenance: "maintenance",
  /** HTML→PDF (Puppeteer or Gotenberg); worker concurrency 3. */
  pdfGenerate: "pdf-generate"
} as const;
