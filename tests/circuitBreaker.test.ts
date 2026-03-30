import { describe, expect, it } from "vitest";
import { CircuitBreaker, CircuitOpenError } from "../src/lib/circuitBreaker";

describe("CircuitBreaker", () => {
  it("opens after threshold failures and rejects fast", async () => {
    const b = new CircuitBreaker("test", 3, 60_000);
    for (let i = 0; i < 3; i += 1) {
      await expect(b.execute(async () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    }
    await expect(b.execute(async () => Promise.resolve(1))).rejects.toBeInstanceOf(CircuitOpenError);
    expect(b.snapshot().state).toBe("OPEN");
  });

  it("closes after reset window in half-open trial", async () => {
    const b = new CircuitBreaker("test2", 2, 50);
    await expect(b.execute(async () => Promise.reject(new Error("a")))).rejects.toThrow("a");
    await expect(b.execute(async () => Promise.reject(new Error("b")))).rejects.toThrow("b");
    await new Promise((r) => setTimeout(r, 60));
    const v = await b.execute(async () => Promise.resolve(42));
    expect(v).toBe(42);
    expect(b.snapshot().state).toBe("CLOSED");
  });
});
