import { describe, expect, it, vi, beforeEach } from "vitest";

const redisMock = vi.hoisted(() => {
  const incr = vi.fn().mockResolvedValue(1);
  const exec = vi.fn().mockResolvedValue([]);
  const multi = vi.fn(() => {
    const chain = {
      incr: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec
    };
    return chain;
  });
  const get = vi.fn().mockResolvedValue("3");
  return { incr, multi, get, exec, conn: { incr, multi, get } as const };
});

vi.mock("../src/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock("../src/lib/redis", () => ({
  redisConnection: redisMock.conn
}));

import { getWaDlqCountLast5Min, incrementWaDlqRolling, recordWhatsAppIngressProcessed } from "../src/whatsapp/wa.metrics";
import { redisConnection } from "../src/lib/redis";

describe("wa.metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.get.mockResolvedValue("3");
  });

  it("recordWhatsAppIngressProcessed increments Redis metric key", () => {
    recordWhatsAppIngressProcessed("919811111111");
    expect(redisConnection?.incr).toHaveBeenCalledWith("pulse:wa:metrics:ingress_processed");
  });

  it("incrementWaDlqRolling runs INCR + EXPIRE pipeline", async () => {
    await incrementWaDlqRolling("ingress");
    expect(redisConnection?.multi).toHaveBeenCalled();
    expect(redisMock.exec).toHaveBeenCalled();
  });

  it("getWaDlqCountLast5Min returns numeric GET", async () => {
    expect(await getWaDlqCountLast5Min("ingress")).toBe(3);
    redisMock.get.mockResolvedValueOnce(null);
    expect(await getWaDlqCountLast5Min("outbound")).toBe(0);
  });
});
