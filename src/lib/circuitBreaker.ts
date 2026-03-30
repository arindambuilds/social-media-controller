export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export class CircuitOpenError extends Error {
  constructor(readonly circuitName: string) {
    super(`CIRCUIT_OPEN:${circuitName}`);
    this.name = "CircuitOpenError";
  }
}

/**
 * Simple async breaker: after `threshold` consecutive failures, short-circuit for `resetMs`.
 * Half-open allows one trial after the reset window.
 */
export class CircuitBreaker {
  private failureCount = 0;
  private state: CircuitState = "CLOSED";
  private openedAt = 0;

  constructor(
    readonly name: string,
    private readonly threshold: number,
    private readonly resetMs: number
  ) {}

  snapshot(): { name: string; state: CircuitState; failureCount: number; openedAt: number } {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      openedAt: this.openedAt
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    if (this.state === "OPEN") {
      if (now - this.openedAt < this.resetMs) {
        throw new CircuitOpenError(this.name);
      }
      this.state = "HALF_OPEN";
    }

    try {
      const result = await fn();
      this.state = "CLOSED";
      this.failureCount = 0;
      return result;
    } catch (err) {
      if (this.state === "HALF_OPEN") {
        this.state = "OPEN";
        this.openedAt = Date.now();
      } else {
        this.failureCount += 1;
        if (this.failureCount >= this.threshold) {
          this.state = "OPEN";
          this.openedAt = Date.now();
        }
      }
      throw err;
    }
  }
}

/** PDF queue + inline Puppeteer path share this breaker (failures open circuit for all export paths). */
export const pdfExportCircuit = new CircuitBreaker("pdf_export", 5, 30_000);
