import { describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  setMock: vi.fn().mockResolvedValue("OK"),
  clientCount: vi.fn(),
  leadCount: vi.fn().mockResolvedValue(42)
}));

vi.mock("../src/lib/redis", () => ({
  redisConnection: { set: hoisted.setMock }
}));

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    client: { count: hoisted.clientCount },
    lead: { count: hoisted.leadCount }
  }
}));

import { GOV_METRICS_REDIS_KEY, GOV_METRICS_TTL_SEC, runRefreshGovMetrics } from "../src/jobs/refreshGovMetrics";

describe("runRefreshGovMetrics", () => {
  it("writes Redis key with TTL 21600", async () => {
    hoisted.setMock.mockClear();
    hoisted.clientCount.mockImplementation(async (args?: { where?: Record<string, unknown> }) => {
      const w = args?.where;
      if (w && w.briefingEnabled === true) return 5;
      if (w && w.language === "or") return 2;
      return 10;
    });
    const out = await runRefreshGovMetrics();
    expect(out.msmes).toBe(5);
    expect(out.leadsThisWeek).toBe(42);
    expect(out.odiaPercent).toBe(20);
    expect(hoisted.setMock).toHaveBeenCalledWith(
      GOV_METRICS_REDIS_KEY,
      expect.any(String),
      "EX",
      GOV_METRICS_TTL_SEC
    );
  });
});
