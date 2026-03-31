import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  messagesCreate: vi.fn()
}));

vi.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  default: class MockAnthropic {
    messages = { create: hoisted.messagesCreate };
  }
}));

import { morningBriefing } from "../src/lib/claudeClient";

/** Mock model output: Odia only, greeting → metrics → insight → close (no English words). */
const MOCK_ODIA_BRIEFING =
  "ନମସ୍କାର ରବି! ଆପଣଙ୍କ ଦୋକାନ ପାଇଁ ଗତକାଲି ୭ ନୂଆ ଫଲୋୟାର, ୩ ଲିଡ୍, ୧୫ ଲାଇକ୍ ଏବଂ ୨ ମନ୍ତବ୍ୟ। ଲିଡ୍‌ମାନଙ୍କୁ ଶୀଘ୍ର ଉତ୍ତର ଦିଅନ୍ତୁ ଓ ଆଜି ସିଡ୍ୟୁଲ୍ ପୋଷ୍ଟ ପ୍ରକାଶ କରନ୍ତୁ। ଆପଣ ଭଲ କରିବେ—ଆମେ ସାଥେ ଅଛୁ।";

describe("morningBriefing (Odia-first Claude path)", () => {
  beforeEach(() => {
    hoisted.messagesCreate.mockReset();
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test-key");
  });

  it("(a) returns output containing Odia script (pure Odia path from model)", async () => {
    hoisted.messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: MOCK_ODIA_BRIEFING }]
    });
    const out = await morningBriefing({ newFollowers: 7, newLeads: 3 }, "odia");
    expect(out).toBe(MOCK_ODIA_BRIEFING);
    expect(/\p{Script=Oriya}/u.test(out)).toBe(true);
    const odiaChars = (out.match(/\p{Script=Oriya}/gu) ?? []).length;
    expect(odiaChars).toBeGreaterThan(40);
  });

  it("(b) follows briefing structure: greeting, then metrics, then actionable close", async () => {
    hoisted.messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: MOCK_ODIA_BRIEFING }]
    });
    const out = await morningBriefing({ newFollowers: 7 }, "or");
    const trimmed = out.trim();
    expect(trimmed.startsWith("ନମସ୍କାର")).toBe(true);
    expect(trimmed).toMatch(/୭|୩|୧୫/);
    expect(trimmed.length).toBeGreaterThan(80);
    expect(/।|\.|\!/.test(trimmed)).toBe(true);
  });

  it("(c) rejects common English briefing leakage in model output", async () => {
    hoisted.messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: MOCK_ODIA_BRIEFING }]
    });
    const out = await morningBriefing({}, "odia");
    const latinWordLeak = /\b(hello|morning|followers|leads|business|insights|dashboard|instagram)\b/i;
    expect(latinWordLeak.test(out)).toBe(false);
    const longLatinRun = /\b[A-Za-z]{5,}\b/;
    expect(longLatinRun.test(out)).toBe(false);
  });
});
