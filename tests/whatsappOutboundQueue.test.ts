import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/redis", () => ({
  redisConnection: null,
  createBullMqConnection: vi.fn(),
  redisEnabled: false
}));

describe("whatsappOutboundQueue", () => {
  it("is null when Redis is unavailable", async () => {
    vi.resetModules();
    const { whatsappOutboundQueue } = await import("../src/queues/whatsappOutboundQueue");
    expect(whatsappOutboundQueue).toBeNull();
  });
});
