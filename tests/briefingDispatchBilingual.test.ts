import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  generateBriefing: vi.fn(),
  findUnique: vi.fn(),
  briefingCreate: vi.fn().mockResolvedValue({ id: "b-bi" }),
  queueAdd: vi.fn().mockResolvedValue(undefined),
  sendWhatsApp: vi.fn().mockResolvedValue(true),
  onPulse: vi.fn().mockResolvedValue(undefined),
  publish: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("../src/lib/claudeClient", () => ({
  generateBriefing: hoisted.generateBriefing
}));

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    client: { findUnique: hoisted.findUnique },
    briefing: { create: hoisted.briefingCreate }
  }
}));

vi.mock("../src/queues/whatsappSendQueue", () => ({
  whatsappSendQueue: { add: hoisted.queueAdd }
}));

vi.mock("../src/services/whatsappSender", () => ({
  sendWhatsApp: hoisted.sendWhatsApp
}));

vi.mock("../src/services/pulseRetention", () => ({
  onPulseBriefingSent: hoisted.onPulse
}));

vi.mock("../src/lib/pulseEvents", () => ({
  publishPulseEvent: hoisted.publish
}));

import { runBriefingDispatchNow } from "../src/jobs/briefingDispatch";

describe("runBriefingDispatchNow (bilingual path)", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    hoisted.generateBriefing.mockReset();
    hoisted.findUnique.mockReset();
    hoisted.briefingCreate.mockClear();
    hoisted.queueAdd.mockClear();
    hoisted.sendWhatsApp.mockClear();
    hoisted.onPulse.mockClear();
    hoisted.publish.mockClear();
  });

  it("enqueues send-brief when queue active (non-test path simulated)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    hoisted.findUnique.mockResolvedValue({
      whatsappNumber: "+919900000001",
      language: "en",
      briefingStreakLastDateIst: null,
      briefingStreakCurrent: 0,
      briefingStreakBest: 0
    });
    hoisted.generateBriefing.mockResolvedValue({
      en: "EN body",
      or: "ଓଡ଼ିଆ ବାର୍ତ୍ତା"
    });
    await runBriefingDispatchNow("client-x");
    expect(hoisted.queueAdd).toHaveBeenCalledTimes(1);
    const [, payload] = hoisted.queueAdd.mock.calls[0]!;
    expect(payload).toMatchObject({ phoneE164: "+919900000001", briefingText: "EN body" });
    expect(hoisted.briefingCreate).toHaveBeenCalled();
    const createArg = hoisted.briefingCreate.mock.calls[0]![0] as {
      data: { content: string };
    };
    const parsed = JSON.parse(createArg.data.content) as { en: string; or: string };
    expect(parsed.en).toBe("EN body");
    expect(parsed.or).toBe("ଓଡ଼ିଆ ବାର୍ତ୍ତା");
  });

  it("uses Odia body when client.language is or", async () => {
    vi.stubEnv("NODE_ENV", "development");
    hoisted.findUnique.mockResolvedValue({
      whatsappNumber: "+919900000002",
      language: "or",
      briefingStreakLastDateIst: null,
      briefingStreakCurrent: 0,
      briefingStreakBest: 0
    });
    hoisted.generateBriefing.mockResolvedValue({
      en: "English",
      or: "ଆପଣଙ୍କ ଦୋକାନ ଆଜି ୩ ଟି ନୂଆ ଲିଡ୍ ପାଇଛି।"
    });
    await runBriefingDispatchNow("client-or");
    const [, payload] = hoisted.queueAdd.mock.calls[0]!;
    expect((payload as { briefingText: string }).briefingText).toMatch(/[\u0B00-\u0B7F]/);
  });

  it("Odia field in stored JSON matches Odia Unicode range", async () => {
    vi.stubEnv("NODE_ENV", "development");
    hoisted.findUnique.mockResolvedValue({
      whatsappNumber: "+919900000003",
      language: "or",
      briefingStreakLastDateIst: null,
      briefingStreakCurrent: 0,
      briefingStreakBest: 0
    });
    hoisted.generateBriefing.mockResolvedValue({
      en: "OK",
      or: "ଶୁଭ ସକାଳ"
    });
    await runBriefingDispatchNow("client-odia");
    const createArg = hoisted.briefingCreate.mock.calls[0]![0] as {
      data: { content: string };
    };
    const parsed = JSON.parse(createArg.data.content) as { or: string };
    expect(parsed.or).toMatch(/[\u0B00-\u0B7F]/);
  });

  it("does not enqueue when Claude fails", async () => {
    vi.stubEnv("NODE_ENV", "development");
    hoisted.findUnique.mockResolvedValue({
      whatsappNumber: "+919900000004",
      language: "en",
      briefingStreakLastDateIst: null,
      briefingStreakCurrent: 0,
      briefingStreakBest: 0
    });
    hoisted.generateBriefing.mockRejectedValue(new Error("bad json"));
    await expect(runBriefingDispatchNow("client-fail")).rejects.toThrow("bad json");
    expect(hoisted.queueAdd).not.toHaveBeenCalled();
    expect(hoisted.briefingCreate).not.toHaveBeenCalled();
  });
});
