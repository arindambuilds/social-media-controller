import { describe, expect, it, vi, beforeEach } from "vitest";

const sendWhatsAppMessage = vi.fn();

vi.mock("../src/services/whatsappCloudApiSender", () => ({
  sendWhatsAppMessage: (...args: unknown[]) => sendWhatsAppMessage(...args)
}));

describe("whatsappOutboundWorker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendWhatsAppMessage.mockResolvedValue({ status: "sent", messageId: "g.1" });
  });

  it("processOutboundJob delegates to sendWhatsAppMessage", async () => {
    const { processOutboundJob } = await import("../src/workers/whatsappOutboundWorker");
    const payload = {
      waId: "15550001111",
      messageType: "freeform" as const,
      payload: { body: "hi" }
    };
    const r = await processOutboundJob(payload);
    expect(r).toEqual({ status: "sent", messageId: "g.1" });
    expect(sendWhatsAppMessage).toHaveBeenCalledWith(payload);
  });

  it("130429 from sendWhatsAppMessage rejects (BullMQ retry path)", async () => {
    const { processOutboundJob } = await import("../src/workers/whatsappOutboundWorker");
    sendWhatsAppMessage.mockRejectedValueOnce(new Error("WA_META_RATE_LIMIT"));
    await expect(
      processOutboundJob({
        waId: "1",
        messageType: "freeform",
        payload: { body: "x" }
      })
    ).rejects.toThrow("WA_META_RATE_LIMIT");
  });

  it("131047 path resolves (template_required) — job completes without throw", async () => {
    const { processOutboundJob } = await import("../src/workers/whatsappOutboundWorker");
    sendWhatsAppMessage.mockResolvedValueOnce({ status: "template_required" });
    const r = await processOutboundJob({
      waId: "1",
      messageType: "freeform",
      payload: { body: "x" }
    });
    expect(r.status).toBe("template_required");
  });

  it("131026 path resolves recipient_unreachable (no retry needed)", async () => {
    const { processOutboundJob } = await import("../src/workers/whatsappOutboundWorker");
    sendWhatsAppMessage.mockResolvedValueOnce({ status: "recipient_unreachable" });
    const r = await processOutboundJob({
      waId: "1",
      messageType: "freeform",
      payload: { body: "x" }
    });
    expect(r.status).toBe("recipient_unreachable");
  });

  it("createWhatsappOutboundWorker is an alias of startWhatsAppOutboundWorker", async () => {
    const mod = await import("../src/workers/whatsappOutboundWorker");
    expect(mod.createWhatsappOutboundWorker).toBe(mod.startWhatsAppOutboundWorker);
  });
});

vi.mock("../src/lib/redis", () => ({
  redisConnection: null,
  createBullMqConnection: vi.fn().mockReturnValue(null),
  redisEnabled: false
}));

describe("whatsappOutboundWorker (no Redis)", () => {
  it("startWhatsAppOutboundWorker returns null without duplicate connection", async () => {
    vi.resetModules();
    const { startWhatsAppOutboundWorker } = await import("../src/workers/whatsappOutboundWorker");
    expect(startWhatsAppOutboundWorker()).toBeNull();
  });
});
