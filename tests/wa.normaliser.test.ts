import { describe, expect, it } from "vitest";
import {
  buildMinimalWebhookBodyFromNormalised,
  normaliseWhatsAppCloudWebhook,
  whatsappWebhookRootSchema
} from "../src/whatsapp/normaliser";

describe("wa.normaliser", () => {
  it("valid text payload → row with kind text, waId, sessionId, messageId, timestamp", () => {
    const body = {
      object: "whatsapp_business_account" as const,
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { phone_number_id: "123456789" },
                contacts: [{ wa_id: "919811111111", profile: { name: "Demo" } }],
                messages: [
                  {
                    from: "919811111111",
                    id: "wamid.abc",
                    timestamp: "1700000000",
                    type: "text",
                    text: { body: "Hello Pulse" }
                  }
                ]
              }
            }
          ]
        }
      ]
    };
    expect(whatsappWebhookRootSchema.safeParse(body).success).toBe(true);
    const rows = normaliseWhatsAppCloudWebhook(body);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.payload.kind).toBe("text");
    expect(rows[0]?.waId).toBe("919811111111");
    expect(rows[0]?.sessionId).toBe("wa:sess:919811111111");
    expect(rows[0]?.messageId).toBe("wamid.abc");
    expect(rows[0]?.timestampUtcMs).toBe(1_700_000_000_000);
    if (rows[0]?.payload.kind === "text") {
      expect(rows[0].payload.body).toBe("Hello Pulse");
    }
  });

  it("valid image payload → row with kind image", () => {
    const body = {
      object: "whatsapp_business_account" as const,
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "99" },
                contacts: [{ wa_id: "1" }],
                messages: [
                  {
                    from: "1",
                    id: "mid1",
                    timestamp: "1000",
                    type: "image",
                    image: { id: "media-xyz", mime_type: "image/jpeg", caption: "pic" }
                  }
                ]
              }
            }
          ]
        }
      ]
    };
    expect(whatsappWebhookRootSchema.safeParse(body).success).toBe(true);
    const rows = normaliseWhatsAppCloudWebhook(body);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.payload.kind).toBe("image");
    expect(rows[0]?.sessionId).toBe("wa:sess:1");
    expect(rows[0]?.messageId).toBe("mid1");
  });

  it("status-style change (no messages array) → empty array, no throw", () => {
    const body = {
      object: "whatsapp_business_account" as const,
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "1" },
                statuses: [{ id: "wamid.x", status: "read" }]
              }
            }
          ]
        }
      ]
    };
    expect(() => normaliseWhatsAppCloudWebhook(body)).not.toThrow();
    expect(normaliseWhatsAppCloudWebhook(body)).toEqual([]);
  });

  it("invalid body {} → safeParse fails and normaliser returns []", () => {
    expect(whatsappWebhookRootSchema.safeParse({}).success).toBe(false);
    expect(normaliseWhatsAppCloudWebhook({})).toEqual([]);
  });

  it("buildMinimalWebhookBodyFromNormalised round-trips text messages", () => {
    const rows = normaliseWhatsAppCloudWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "999" },
                contacts: [{ wa_id: "919811111111", profile: { name: "X" } }],
                messages: [
                  {
                    from: "919811111111",
                    id: "wamid.rt",
                    timestamp: "1700000001",
                    type: "text",
                    text: { body: "Hi" }
                  }
                ]
              }
            }
          ]
        }
      ]
    });
    expect(rows).toHaveLength(1);
    const m = rows[0]!;
    const rebuilt = buildMinimalWebhookBodyFromNormalised(m);
    const again = normaliseWhatsAppCloudWebhook(rebuilt);
    expect(again).toHaveLength(1);
    expect(again[0]?.messageId).toBe(m.messageId);
    expect(again[0]?.waId).toBe(m.waId);
  });
});
