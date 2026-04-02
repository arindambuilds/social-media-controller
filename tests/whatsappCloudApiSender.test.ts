import { describe, expect, it, vi, beforeEach } from "vitest";

const getLastInboundTs = vi.fn();
const recordViolation = vi.fn();
const recordFailed = vi.fn();
const recordSent = vi.fn();

vi.mock("../src/whatsapp/session.store", () => ({
  getLastInboundTs: (...args: unknown[]) => getLastInboundTs(...args)
}));

vi.mock("../src/whatsapp/wa.metrics", () => ({
  recordWhatsApp24hViolation: (...args: unknown[]) => recordViolation(...args),
  recordWhatsAppOutboundFailed: (...args: unknown[]) => recordFailed(...args),
  recordWhatsAppOutboundSent: (...args: unknown[]) => recordSent(...args)
}));

const mockGet = vi.fn();
const mockSet = vi.fn().mockResolvedValue("OK");

vi.mock("../src/lib/redis", () => ({
  redisConnection: {
    get: (...args: unknown[]) => mockGet(...args),
    set: (...args: unknown[]) => mockSet(...args)
  }
}));

vi.mock("../src/config/env", () => ({
  env: {
    NODE_ENV: "test",
    WA_PHONE_NUMBER_ID: "phone-id-1",
    WA_ACCESS_TOKEN: "access-token-1",
    WA_TOKEN: "",
    WA_API_VERSION: "v19.0",
    WA_GRAPH_ACCESS_TOKEN: "access-token-1"
  }
}));

import {
  sendWhatsAppMessage,
  WhatsAppMetaRateLimitError
} from "../src/services/whatsappCloudApiSender";

describe("whatsappCloudApiSender sendWhatsAppMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue(null);
    getLastInboundTs.mockResolvedValue(Date.now() - 60_000);
  });

  it("returns 24h_window_expired for freeform when last inbound is absent", async () => {
    getLastInboundTs.mockResolvedValue(null);
    const r = await sendWhatsAppMessage(
      { waId: "15550001111", messageType: "freeform", payload: { body: "hi" } },
      vi.fn() as unknown as typeof fetch
    );
    expect(r.status).toBe("24h_window_expired");
    expect(recordViolation).toHaveBeenCalledWith("15550001111");
  });

  it("POSTs to Graph and records sent on 200", async () => {
    getLastInboundTs.mockResolvedValue(Date.now() - 30_000);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: "g.1" }] })
    });
    const r = await sendWhatsAppMessage(
      { waId: "15550001111", messageType: "freeform", payload: { body: "hello" } },
      fetchMock as unknown as typeof fetch
    );
    expect(r.status).toBe("sent");
    expect(recordSent).toHaveBeenCalledWith("15550001111");
    expect(fetchMock).toHaveBeenCalled();
    const call = fetchMock.mock.calls[0]!;
    expect(String(call[0])).toContain("graph.facebook.com/v19.0/");
    expect(String(call[0])).toContain("phone-id-1");
    const init = call[1] as RequestInit;
    expect(init.headers && (init.headers as Record<string, string>)["Authorization"]).toMatch(/^Bearer /);
  });

  it("throws WhatsAppMetaRateLimitError on 130429", async () => {
    getLastInboundTs.mockResolvedValue(Date.now());
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { code: 130429, message: "rate limit" } })
    });
    await expect(
      sendWhatsAppMessage(
        { waId: "15550001111", messageType: "template", payload: { name: "hello", language: { code: "en" } } },
        fetchMock as unknown as typeof fetch
      )
    ).rejects.toBeInstanceOf(WhatsAppMetaRateLimitError);
  });

  it("returns template_required on 131047", async () => {
    getLastInboundTs.mockResolvedValue(Date.now());
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { code: 131047, message: "outside window" } })
    });
    const r = await sendWhatsAppMessage(
      { waId: "15550001111", messageType: "freeform", payload: { body: "x" } },
      fetchMock as unknown as typeof fetch
    );
    expect(r.status).toBe("template_required");
    expect(recordFailed).toHaveBeenCalledWith("15550001111", 131047);
  });

  it("returns recipient_unreachable on 131026 and sets pause key", async () => {
    getLastInboundTs.mockResolvedValue(Date.now());
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { code: 131026, message: "unreachable" } })
    });
    const r = await sendWhatsAppMessage(
      { waId: "15550001111", messageType: "freeform", payload: { body: "x" } },
      fetchMock as unknown as typeof fetch
    );
    expect(r.status).toBe("recipient_unreachable");
    expect(mockSet).toHaveBeenCalled();
    expect(recordFailed).toHaveBeenCalledWith("15550001111", 131026);
  });
});
