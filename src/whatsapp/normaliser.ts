import { z } from "zod";
import type {
  PulseNormalisedWhatsAppMessage,
  PulseWhatsAppInboundMedia,
  PulseWhatsAppInboundPayload,
  PulseWhatsAppInboundText,
  PulseWhatsAppMessageKind
} from "../types/pulse-message.types";

/** Root webhook envelope — invalid bodies fail safeParse so callers return []. */
export const whatsappWebhookRootSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(z.unknown()).optional()
});

function toSessionId(waId: string): string {
  return `wa:sess:${waId}`;
}

function parseTimestampSec(raw: string | undefined): number {
  if (!raw) {
    return Math.floor(Date.now() / 1000);
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : Math.floor(Date.now() / 1000);
}

function buildTextPayload(body: Record<string, unknown>): PulseWhatsAppInboundText | null {
  const text = body.text;
  if (!text || typeof text !== "object") {
    return null;
  }
  const t = text as Record<string, unknown>;
  const b = t.body;
  if (typeof b !== "string" || !b.length) {
    return null;
  }
  return { kind: "text", body: b };
}

function buildMediaPayload(
  type: PulseWhatsAppMessageKind,
  body: Record<string, unknown>
): PulseWhatsAppInboundMedia | null {
  const node = body[type];
  if (!node || typeof node !== "object") {
    return null;
  }
  const n = node as Record<string, unknown>;
  const id = n.id;
  if (typeof id !== "string" || !id.length) {
    return null;
  }
  const mimeType = typeof n.mime_type === "string" ? n.mime_type : undefined;
  const caption = typeof n.caption === "string" ? n.caption : undefined;
  return { kind: type as PulseWhatsAppInboundMedia["kind"], mediaId: id, mimeType, caption };
}

function normaliseSingleMessage(
  msg: Record<string, unknown>,
  phoneNumberId: string,
  waId: string,
  contactName: string | undefined
): PulseNormalisedWhatsAppMessage | null {
  const from = msg.from;
  const id = msg.id;
  const ts = msg.timestamp;
  const type = msg.type;
  if (typeof from !== "string" || typeof id !== "string") {
    return null;
  }
  const effectiveWaId = from.length ? from : waId;
  const sessionId = toSessionId(effectiveWaId);
  const timestampUtcMs = parseTimestampSec(typeof ts === "string" ? ts : undefined) * 1000;

  let payload: PulseWhatsAppInboundPayload | null = null;
  if (type === "text") {
    payload = buildTextPayload(msg);
  } else if (type === "image") {
    payload = buildMediaPayload("image", msg);
  } else if (type === "video") {
    payload = buildMediaPayload("video", msg);
  } else if (type === "audio") {
    payload = buildMediaPayload("audio", msg);
  } else if (type === "document") {
    payload = buildMediaPayload("document", msg);
  } else if (type === "sticker") {
    payload = buildMediaPayload("sticker", msg);
  }

  if (!payload) {
    return null;
  }

  return {
    source: "whatsapp",
    messageId: id,
    waId: effectiveWaId,
    phoneNumberId,
    sessionId,
    timestampUtcMs,
    contactName,
    payload
  };
}

/**
 * Flattens WhatsApp Cloud API `messages` webhooks into normalised rows.
 */
export function normaliseWhatsAppCloudWebhook(body: unknown): PulseNormalisedWhatsAppMessage[] {
  const rootParsed = whatsappWebhookRootSchema.safeParse(body);
  if (!rootParsed.success) {
    return [];
  }
  const entry = rootParsed.data.entry ?? [];
  const out: PulseNormalisedWhatsAppMessage[] = [];

  for (const ent of entry) {
    if (!ent || typeof ent !== "object") {
      continue;
    }
    const changes = (ent as Record<string, unknown>).changes;
    if (!Array.isArray(changes)) {
      continue;
    }
    for (const ch of changes) {
      if (!ch || typeof ch !== "object") {
        continue;
      }
      const c = ch as Record<string, unknown>;
      if (c.field !== "messages") {
        continue;
      }
      const value = c.value;
      if (!value || typeof value !== "object") {
        continue;
      }
      const v = value as Record<string, unknown>;
      const meta = v.metadata;
      let phoneNumberId = "";
      if (meta && typeof meta === "object") {
        const pid = (meta as Record<string, unknown>).phone_number_id;
        if (typeof pid === "string") {
          phoneNumberId = pid;
        }
      }
      if (!phoneNumberId.length) {
        continue;
      }

      const contacts = v.contacts;
      let defaultName: string | undefined;
      let defaultWaId = "";
      if (Array.isArray(contacts) && contacts[0] && typeof contacts[0] === "object") {
        const ct = contacts[0] as Record<string, unknown>;
        if (typeof ct.wa_id === "string") {
          defaultWaId = ct.wa_id;
        }
        const profile = ct.profile;
        if (profile && typeof profile === "object") {
          const name = (profile as Record<string, unknown>).name;
          if (typeof name === "string") {
            defaultName = name;
          }
        }
      }

      const messages = v.messages;
      if (!Array.isArray(messages)) {
        continue;
      }
      for (const rawMsg of messages) {
        if (!rawMsg || typeof rawMsg !== "object") {
          continue;
        }
        const row = normaliseSingleMessage(
          rawMsg as Record<string, unknown>,
          phoneNumberId,
          defaultWaId,
          defaultName
        );
        if (row) {
          out.push(row);
        }
      }
    }
  }

  return out;
}

/**
 * Rebuilds a minimal Meta webhook body so {@link normaliseWhatsAppCloudWebhook} round-trips
 * a stored {@link PulseNormalisedWhatsAppMessage} (ingress worker validation).
 */
export function buildMinimalWebhookBodyFromNormalised(
  m: PulseNormalisedWhatsAppMessage
): Record<string, unknown> {
  const ts = String(Math.floor(m.timestampUtcMs / 1000));
  const baseMsg: Record<string, unknown> = {
    id: m.messageId,
    from: m.waId,
    timestamp: ts
  };
  if (m.payload.kind === "text") {
    baseMsg.type = "text";
    baseMsg.text = { body: m.payload.body };
  } else if (m.payload.kind === "unknown") {
    throw new Error("buildMinimalWebhookBodyFromNormalised: unknown payload cannot be round-tripped");
  } else {
    const k = m.payload.kind;
    baseMsg.type = k;
    baseMsg[k] = {
      id: m.payload.mediaId,
      ...(m.payload.mimeType ? { mime_type: m.payload.mimeType } : {}),
      ...(m.payload.caption ? { caption: m.payload.caption } : {})
    };
  }

  return {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: m.phoneNumberId },
              contacts: [
                {
                  wa_id: m.waId,
                  ...(m.contactName ? { profile: { name: m.contactName } } : {})
                }
              ],
              messages: [baseMsg]
            }
          }
        ]
      }
    ]
  };
}
