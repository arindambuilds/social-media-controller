import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  const queueAdd = vi.fn().mockResolvedValue(undefined);
  const findUnique = vi.fn();
  const clientUpdate = vi.fn().mockResolvedValue({});
  const briefingCreate = vi.fn().mockResolvedValue({ id: "brief-1" });
  const messagesCreate = vi.fn();
  return { queueAdd, findUnique, clientUpdate, briefingCreate, messagesCreate };
});

vi.stubEnv("NODE_ENV", "development");

vi.mock("../src/queues/whatsappSendQueue", () => ({
  whatsappSendQueue: {
    add: hoisted.queueAdd
  }
}));

vi.mock("../src/services/briefingAgent", () => ({
  generateBriefing: vi.fn().mockResolvedValue({
    content: "MOCK_MAIN_BRIEFING_PARAGRAPH",
    claudeSucceeded: true
  })
}));

vi.mock("../src/services/briefingData", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/services/briefingData")>();
  return {
    ...actual,
    getBriefingData: vi.fn().mockResolvedValue({
      businessName: "Test Co",
      ownerName: "Ravi",
      newFollowers: 2,
      totalFollowers: 50,
      newLeads: 1,
      likesYesterday: 3,
      commentsYesterday: 1,
      topPost: null,
      scheduledToday: 1
    })
  };
});

vi.mock("../src/lib/pulseEvents", () => ({
  publishPulseEvent: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("../src/services/whatsappSender", () => ({
  sendBriefingEmailHtml: vi.fn().mockResolvedValue(true),
  sendWhatsApp: vi.fn().mockResolvedValue(true)
}));

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    client: { findUnique: hoisted.findUnique, update: hoisted.clientUpdate },
    briefing: { create: hoisted.briefingCreate },
    pulseNudgeLog: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "n1" })
    }
  }
}));

vi.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  default: class MockAnthropic {
    messages = { create: hoisted.messagesCreate };
  }
}));

import { runBriefingNow } from "../src/jobs/morningBriefing";
import { executeWhatsAppSendJob } from "../src/services/whatsappSendExecutor";
import { logger } from "../src/lib/logger";

describe("briefing dispatch chain", () => {
  beforeEach(() => {
    hoisted.queueAdd.mockClear();
    hoisted.findUnique.mockReset();
    hoisted.briefingCreate.mockClear();
    hoisted.clientUpdate.mockClear();
    hoisted.messagesCreate.mockClear();
  });

  it("runBriefingNow enqueues exactly 1 whatsapp-send job with phone and briefing body", async () => {
    hoisted.findUnique.mockResolvedValue({
      id: "dispatch-test-client",
      whatsappNumber: "+919876543210",
      briefingStreakLastDateIst: null,
      briefingStreakCurrent: 0,
      briefingStreakBest: 0,
      owner: { email: null, plan: "free" }
    });

    await runBriefingNow("dispatch-test-client");

    expect(hoisted.queueAdd).toHaveBeenCalledTimes(1);
    const [name, data] = hoisted.queueAdd.mock.calls[0]!;
    expect(name).toBe("send-brief");
    expect(data).toMatchObject({
      phoneE164: "+919876543210"
    });
    expect(typeof data.briefingText).toBe("string");
    expect((data as { briefingText: string }).briefingText.length).toBeGreaterThan(0);
    expect(hoisted.clientUpdate).toHaveBeenCalled();
  });

  it("enqueued job carries correct retry options", async () => {
    hoisted.findUnique.mockResolvedValue({
      id: "dispatch-test-client",
      whatsappNumber: "+919876543210",
      briefingStreakLastDateIst: null,
      briefingStreakCurrent: 0,
      briefingStreakBest: 0,
      owner: { email: null, plan: "free" }
    });

    await runBriefingNow("dispatch-test-client");

    const opts = hoisted.queueAdd.mock.calls[0]![2] as {
      attempts?: number;
      backoff?: { type?: string; delay?: number };
    };
    expect(opts.attempts).toBe(3);
    expect(opts.backoff?.type).toBe("exponential");
    expect(opts.backoff?.delay).toBe(1000);
  });

  it("Claude is NOT called inside the whatsapp send executor path", async () => {
    await executeWhatsAppSendJob(
      { phoneE164: "+919900000001", briefingText: "plain body", dateStr: "2026-03-30" },
      {
        redisSetNx: vi.fn().mockResolvedValue("OK"),
        redisSet: vi.fn().mockResolvedValue(undefined),
        redisDel: vi.fn().mockResolvedValue(undefined),
        sendTwilio: vi.fn().mockResolvedValue(undefined)
      }
    );
    expect(hoisted.messagesCreate).not.toHaveBeenCalled();
  });

  it("runBriefingNow logs [briefing] Starting when DEBUG_BRIEFING=1", async () => {
    vi.stubEnv("DEBUG_BRIEFING", "1");
    const logSpy = vi.spyOn(logger, "info").mockImplementation(() => logger);
    hoisted.findUnique.mockResolvedValue({
      id: "dispatch-test-client",
      whatsappNumber: "+919876543210",
      briefingStreakLastDateIst: null,
      briefingStreakCurrent: 0,
      briefingStreakBest: 0,
      owner: { email: null, plan: "free" }
    });
    await runBriefingNow("dispatch-test-client");
    expect(logSpy).toHaveBeenCalledWith("[briefing] Starting", { clientId: "dispatch-test-client" });
    logSpy.mockRestore();
    vi.unstubAllEnvs();
  });
});
