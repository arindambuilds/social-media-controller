import { describe, expect, it, vi } from "vitest";
import { executeWhatsAppSendJob } from "../src/services/whatsappSendExecutor";

const { mockCreate, factory } = vi.hoisted(() => {
  const mockCreate = vi.fn();
  return {
    mockCreate,
    factory: vi.fn(() => ({ messages: { create: mockCreate } }))
  };
});

vi.mock("twilio", () => ({
  __esModule: true,
  default: factory
}));

import { sendWhatsAppStrict } from "../src/services/whatsappSender";

describe("WhatsApp briefing send (executor)", () => {
  it("happy-path: Twilio called once when Redis lock acquired", async () => {
    const sendTwilio = vi.fn().mockResolvedValue(undefined);
    const redisSetNx = vi.fn().mockResolvedValue("OK");
    const redisSet = vi.fn().mockResolvedValue(undefined);
    const redisDel = vi.fn().mockResolvedValue(1);
    await executeWhatsAppSendJob(
      { phoneE164: "+919876543210", briefingText: "Hello", dateStr: "2026-03-31" },
      { redisSetNx, redisSet, redisDel, sendTwilio }
    );
    expect(sendTwilio).toHaveBeenCalledTimes(1);
  });

  it("idempotency: second job with same date+phone skips Twilio", async () => {
    const sendTwilio = vi.fn().mockResolvedValue(undefined);
    const redisSetNx = vi.fn().mockResolvedValueOnce("OK").mockResolvedValueOnce(null);
    const redisSet = vi.fn().mockResolvedValue(undefined);
    const redisDel = vi.fn().mockResolvedValue(1);
    const deps = { redisSetNx, redisSet, redisDel, sendTwilio };
    const data = { phoneE164: "+919876543210", briefingText: "Hello", dateStr: "2026-03-31" };
    await executeWhatsAppSendJob(data, deps);
    await executeWhatsAppSendJob(data, deps);
    expect(sendTwilio).toHaveBeenCalledTimes(1);
  });

  it("error-path: Twilio 429 propagates and Redis lock is released", async () => {
    const sendTwilio = vi.fn().mockRejectedValue(Object.assign(new Error("rate limit"), { status: 429 }));
    const redisSetNx = vi.fn().mockResolvedValue("OK");
    const redisSet = vi.fn().mockResolvedValue(undefined);
    const redisDel = vi.fn().mockResolvedValue(1);
    await expect(
      executeWhatsAppSendJob(
        { phoneE164: "+919876543210", briefingText: "Hello", dateStr: "2026-03-31" },
        { redisSetNx, redisSet, redisDel, sendTwilio }
      )
    ).rejects.toThrow();
    expect(redisDel).toHaveBeenCalled();
  });
});

describe("sendWhatsAppStrict (Twilio 400 swallowed)", () => {
  it("logs Twilio SID when DEBUG_BRIEFING=1 and create returns sid", async () => {
    const sid = "SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    mockCreate.mockResolvedValueOnce({ sid });
    process.env.TWILIO_ACCOUNT_SID = "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+14155238886";
    vi.stubEnv("DEBUG_BRIEFING", "1");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await sendWhatsAppStrict("+919876543210", "body");
    expect(logSpy).toHaveBeenCalledWith("[whatsapp] Twilio SID:", sid);
    logSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it("does not throw on HTTP 400", async () => {
    mockCreate.mockRejectedValueOnce(Object.assign(new Error("bad"), { status: 400 }));
    process.env.TWILIO_ACCOUNT_SID = "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+14155238886";
    await expect(sendWhatsAppStrict("+919876543210", "body")).resolves.toBeUndefined();
    expect(mockCreate).toHaveBeenCalled();
  });
});
