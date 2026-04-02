import type Redis from "ioredis";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { evalMock } = vi.hoisted(() => ({ evalMock: vi.fn() }));

vi.mock("../src/lib/redis", () => ({
  redisConnection: {
    eval: (...args: unknown[]) => evalMock(...args)
  } as Pick<Redis, "eval">
}));

import { evaluateWhatsAppWaRateLimit } from "../src/whatsapp/rate-limiter";

describe("wa.rate-limiter", () => {
  beforeEach(() => {
    evalMock.mockReset();
  });

  it("eval returns 1 → allowed true, count ≤ 30", async () => {
    evalMock.mockResolvedValueOnce(1);
    const r = await evaluateWhatsAppWaRateLimit("15551234");
    expect(r.allowed).toBe(true);
    expect(r.count).toBeLessThanOrEqual(30);
  });

  it("eval returns 0 → allowed false, count 31", async () => {
    evalMock.mockResolvedValueOnce(0);
    const r = await evaluateWhatsAppWaRateLimit("15551234");
    expect(r.allowed).toBe(false);
    expect(r.count).toBe(31);
  });

  it("eval throws → graceful degradation allowed true", async () => {
    evalMock.mockRejectedValueOnce(new Error("redis down"));
    const r = await evaluateWhatsAppWaRateLimit("15551234");
    expect(r.allowed).toBe(true);
  });
});
