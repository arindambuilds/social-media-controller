import { describe, expect, it, vi, beforeEach } from "vitest";

const { updateSession, scheduleMedia, recordProcessed, getSessionContext, getLastInboundTs } = vi.hoisted(
  () => ({
    updateSession: vi.fn().mockResolvedValue(undefined),
    scheduleMedia: vi.fn(),
    recordProcessed: vi.fn(),
    getSessionContext: vi.fn().mockResolvedValue([]),
    /** No Redis in test — dispatcher short-circuits without enqueue. */
    getLastInboundTs: vi.fn().mockResolvedValue(null)
  })
);

vi.mock("../src/lib/redis", () => ({ redisConnection: null }));

vi.mock("../src/whatsapp/session.store", () => ({
  updateSessionFromNormalisedMessage: (redis: unknown, msg: unknown) => updateSession(redis, msg),
  getSessionContext: (waId: string) => getSessionContext(waId),
  getLastInboundTs: (redis: unknown, waId: string) => getLastInboundTs(redis, waId)
}));

vi.mock("../src/whatsapp/media.handler", () => ({
  scheduleWhatsAppMediaIngest: (redis: unknown, msg: unknown) => scheduleMedia(redis, msg)
}));

vi.mock("../src/whatsapp/wa.metrics", () => ({
  recordWhatsAppIngressProcessed: (waId: string) => recordProcessed(waId),
  recordWhatsAppIngressDlq: vi.fn()
}));

import type { WhatsAppIngressQueuePayload } from "../src/types/pulse-message.types";
import { processWhatsAppIngressJob } from "../src/workers/whatsappIngressWorker";

function flushImmediate(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe("whatsappIngressWorker processWhatsAppIngressJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalises, updates session, records processed (text)", async () => {
    const message: WhatsAppIngressQueuePayload["message"] = {
      source: "whatsapp",
      messageId: "wamid.job1",
      waId: "919811111111",
      phoneNumberId: "123",
      sessionId: "wa:sess:919811111111",
      timestampUtcMs: 1_700_000_000_000,
      payload: { kind: "text", body: "hello" }
    };
    const payload: WhatsAppIngressQueuePayload = {
      source: "whatsapp",
      waId: message.waId,
      sessionId: message.sessionId,
      message,
      withinCustomerCareWindow: true
    };
    await processWhatsAppIngressJob(payload);
    await flushImmediate();
    expect(updateSession).toHaveBeenCalledTimes(1);
    expect(recordProcessed).toHaveBeenCalledWith("919811111111");
    expect(scheduleMedia).not.toHaveBeenCalled();
  });

  it("unknown payload kind skips round-trip normaliser but still updates session", async () => {
    const message: WhatsAppIngressQueuePayload["message"] = {
      source: "whatsapp",
      messageId: "wamid.unk",
      waId: "919800000000",
      phoneNumberId: "999",
      sessionId: "wa:sess:919800000000",
      timestampUtcMs: Date.now(),
      payload: { kind: "unknown" }
    };
    const payload: WhatsAppIngressQueuePayload = {
      source: "whatsapp",
      waId: message.waId,
      sessionId: message.sessionId,
      message,
      withinCustomerCareWindow: false
    };
    await processWhatsAppIngressJob(payload);
    await flushImmediate();
    expect(updateSession).toHaveBeenCalledWith(null, message);
    expect(recordProcessed).toHaveBeenCalledWith("919800000000");
  });
});
