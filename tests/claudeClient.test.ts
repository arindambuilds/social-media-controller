import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  findUnique: vi.fn(),
  messagesCreate: vi.fn()
}));

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    client: { findUnique: hoisted.findUnique }
  }
}));

vi.mock("../src/services/briefingData", () => ({
  getBriefingData: vi.fn().mockResolvedValue({
    businessName: "Test",
    ownerName: "Ravi",
    newFollowers: 1,
    totalFollowers: 10,
    newLeads: 2,
    likesYesterday: 3,
    commentsYesterday: 1,
    topPost: null,
    scheduledToday: 0
  })
}));

vi.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  default: class MockAnthropic {
    messages = { create: hoisted.messagesCreate };
  }
}));

import { BriefingGenerationError, generateBriefing } from "../src/lib/claudeClient";

describe("claudeClient.generateBriefing", () => {
  beforeEach(() => {
    hoisted.findUnique.mockReset();
    hoisted.messagesCreate.mockReset();
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test-key");
  });

  it("parses valid bilingual JSON from Claude", async () => {
    hoisted.findUnique.mockResolvedValue({ id: "c1", name: "Shop", language: "en" });
    hoisted.messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: '{"en":"Hello day","or":"ନମସ୍କାର"}' }]
    });
    const out = await generateBriefing("c1", "en");
    expect(out.en).toBe("Hello day");
    expect(out.or).toBe("ନମସ୍କାର");
  });

  it("throws BriefingGenerationError on invalid JSON", async () => {
    hoisted.findUnique.mockResolvedValue({ id: "c1", name: "Shop", language: "en" });
    hoisted.messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "not json at all" }]
    });
    await expect(generateBriefing("c1", "en")).rejects.toThrow(BriefingGenerationError);
  });

  it("throws when en/or schema fails", async () => {
    hoisted.findUnique.mockResolvedValue({ id: "c1", name: "Shop", language: "en" });
    hoisted.messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: '{"en":"","or":"x"}' }]
    });
    await expect(generateBriefing("c1", "en")).rejects.toThrow(BriefingGenerationError);
  });
});
