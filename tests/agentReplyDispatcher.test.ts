import { describe, expect, it, vi, beforeEach } from "vitest";

const getLastInboundTs = vi.fn();
const generateWhatsAppReply = vi.fn();
const queueAdd = vi.fn().mockResolvedValue(undefined);

vi.mock("../src/whatsapp/session.store", () => ({
  getLastInboundTs: (...args: unknown[]) => getLastInboundTs(...args)
}));

vi.mock("../src/whatsapp/whatsappReplyAgent", () => ({
  generateWhatsAppReply: (...args: unknown[]) => generateWhatsAppReply(...args)
}));

vi.mock("../src/queues/whatsappOutboundQueue", () => ({
  whatsappOutboundQueue: {
    add: (...args: unknown[]) => queueAdd(...args)
  }
}));

vi.mock("../src/lib/redis", () => ({
  redisConnection: {}
}));

import { dispatchAgentReply } from "../src/whatsapp/agentReplyDispatcher";
import type { PulseMessage } from "../src/types/pulse-message.types";

function textMessage(overrides: Partial<PulseMessage> = {}): PulseMessage {
  return {
    source: "whatsapp",
    messageId: "wamid.test",
    waId: "919811111111",
    phoneNumberId: "123",
    sessionId: "wa:sess:919811111111",
    timestampUtcMs: Date.now(),
    payload: { kind: "text", body: "Hi" },
    ...overrides
  };
}

describe("agentReplyDispatcher dispatchAgentReply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLastInboundTs.mockResolvedValue(Date.now() - 100 * 1000);
    generateWhatsAppReply.mockResolvedValue("Hello!");
    queueAdd.mockResolvedValue(undefined);
  });

  it("enqueues reply when window open and Claude returns text", async () => {
    await dispatchAgentReply(textMessage(), []);
    expect(queueAdd).toHaveBeenCalledTimes(1);
    const call = queueAdd.mock.calls[0]!;
    expect(call[0]).toBe("reply");
    expect(call[1]).toMatchObject({
      source: "agent",
      waId: "919811111111",
      correlationId: "wamid.test",
      messageType: "freeform",
      payload: { body: "Hello!" }
    });
  });

  it("does not enqueue when window expired (>86400s)", async () => {
    getLastInboundTs.mockResolvedValue(Date.now() - 90_000 * 1000);
    await dispatchAgentReply(textMessage(), []);
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("does not enqueue when getLastInboundTs is null", async () => {
    getLastInboundTs.mockResolvedValue(null);
    await dispatchAgentReply(textMessage(), []);
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("does not enqueue when Claude returns null", async () => {
    generateWhatsAppReply.mockResolvedValue(null);
    await dispatchAgentReply(textMessage(), []);
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("passes correlationId equal to messageId", async () => {
    await dispatchAgentReply(textMessage({ messageId: "wamid.correl" }), []);
    expect(queueAdd).toHaveBeenCalledWith(
      "reply",
      expect.objectContaining({
        correlationId: "wamid.correl"
      })
    );
  });

  it("resolves when queue.add rejects", async () => {
    queueAdd.mockRejectedValueOnce(new Error("Redis down"));
    await expect(dispatchAgentReply(textMessage(), [])).resolves.toBeUndefined();
  });
});
