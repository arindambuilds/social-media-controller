import { afterEach, describe, expect, it, vi } from "vitest";
import type { BriefingData } from "../src/services/briefingData";

const messagesCreate = vi.fn().mockResolvedValue({
  content: [{ type: "text", text: "MOCK_BRIEFING_UNIQUE_TOKEN pilot run" }]
});

vi.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(() => ({
    messages: { create: messagesCreate }
  }))
}));

import { generateBriefing } from "../src/services/briefingAgent";

const sampleBriefingData: BriefingData = {
  businessName: "Test Studio",
  ownerName: "Ravi",
  newFollowers: 1,
  totalFollowers: 10,
  newLeads: 0,
  likesYesterday: 2,
  commentsYesterday: 1,
  topPost: null,
  scheduledToday: 0
};

describe("live briefing instrumentation (Cycle 5)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    messagesCreate.mockClear();
  });

  it("generateBriefing returns a non-empty string containing mocked Claude text when API key is set", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-key-for-vitest-only");
    const { content } = await generateBriefing(sampleBriefingData);
    expect(content.length).toBeGreaterThan(0);
    expect(content).toContain("MOCK_BRIEFING_UNIQUE_TOKEN");
    expect(messagesCreate).toHaveBeenCalled();
  });
});
