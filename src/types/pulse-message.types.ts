/**
 * Normalised shapes for PulseOS WhatsApp Cloud API ingress (Meta).
 */

export type PulseMessageSource = "whatsapp";

export type PulseWhatsAppMessageKind =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "sticker"
  | "unknown";

/** One conversational turn stored in Redis (short) and mirrored to Supabase (full). */
export interface PulseWhatsAppSessionTurn {
  role: "user";
  waId: string;
  sessionId: string;
  messageId: string;
  timestampUtcMs: number;
  text?: string;
  mediaId?: string;
  mediaKind?: PulseWhatsAppMessageKind;
  /** Filled after async media upload to object storage */
  mediaStorageUrl?: string;
}

export interface PulseWhatsAppInboundText {
  kind: "text";
  body: string;
}

export interface PulseWhatsAppInboundMedia {
  kind: Exclude<PulseWhatsAppMessageKind, "text" | "unknown">;
  mediaId: string;
  mimeType?: string;
  caption?: string;
}

/** Rare path: synthetic or legacy rows that cannot be round-tripped through Meta webhook JSON. */
export interface PulseWhatsAppInboundUnknown {
  kind: "unknown";
}

export type PulseWhatsAppInboundPayload =
  | PulseWhatsAppInboundText
  | PulseWhatsAppInboundMedia
  | PulseWhatsAppInboundUnknown;

/** Canonical inbound message after Meta webhook normalisation. */
export interface PulseNormalisedWhatsAppMessage {
  source: PulseMessageSource;
  messageId: string;
  waId: string;
  phoneNumberId: string;
  sessionId: string;
  timestampUtcMs: number;
  contactName?: string;
  payload: PulseWhatsAppInboundPayload;
}

/** Alias for agent / reply pipeline (same shape as normalised Cloud API rows). */
export type PulseMessage = PulseNormalisedWhatsAppMessage;

/**
 * BullMQ payload for downstream worker (do not mutate ingestionQueue).
 * Every job must carry source + WhatsApp id + session id.
 */
export interface WhatsAppIngressQueuePayload {
  source: "whatsapp";
  waId: string;
  sessionId: string;
  message: PulseNormalisedWhatsAppMessage;
  /** If false, outbound session messages must use template / deferred send path. */
  withinCustomerCareWindow: boolean;
}
