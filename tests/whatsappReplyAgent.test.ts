import { describe, expect, it, vi, beforeEach } from "vitest";

const messagesCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = {
      create: (...args: unknown[]) => messagesCreate(...args)
    };
  }
}));

vi.mock("../src/config/env", () => ({
  env: {
    NODE_ENV: "test",
    ANTHROPIC_API_KEY: "sk-ant-test-key-for-unit-tests-only"
  }
}));

import { generateWhatsAppReply } from "../src/whatsapp/whatsappReplyAgent";
import type { PulseMessage } from "../src/types/pulse-message.types";

function textMessage(body: string): PulseMessage {
  return {
    source: "whatsapp",
    messageId: "wamid.1",
    waId: "919800000001",
    phoneNumberId: "p1",
    sessionId: "wa:sess:919800000001",
    timestampUtcMs: Date.now(),
    payload: { kind: "text", body }
  };
}

describe("whatsappReplyAgent generateWhatsAppReply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "Thanks for writing! We will help shortly." }]
    });
  });

  it("returns string reply on successful Claude call", async () => {
    const r = await generateWhatsAppReply(textMessage("Need price"), []);
    expect(r).toBe("Thanks for writing! We will help shortly.");
    expect(messagesCreate).toHaveBeenCalledTimes(1);
  });

  it("includes last 3 sessionContext turns in the user prompt", async () => {
    const ctx = ["older", "mid", "newer"];
    await generateWhatsAppReply(textMessage("latest"), ctx);
    const arg = messagesCreate.mock.calls[0]![0] as {
      messages: { content: string }[];
    };
    const user = arg.messages[0]!.content;
    expect(user).toContain("1. older");
    expect(user).toContain("2. mid");
    expect(user).toContain("3. newer");
    expect(user).toContain("Latest message:");
    expect(user).toContain("latest");
  });

  it("returns null when Claude call throws", async () => {
    messagesCreate.mockRejectedValueOnce(new Error("rate limited"));
    const r = await generateWhatsAppReply(textMessage("x"), []);
    expect(r).toBeNull();
  });

  it("returns null when Claude returns empty text content", async () => {
    messagesCreate.mockResolvedValueOnce({ content: [{ type: "text", text: "   " }] });
    const r = await generateWhatsAppReply(textMessage("x"), []);
    expect(r).toBeNull();
  });
});
