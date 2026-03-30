import { describe, expect, it } from "vitest";
import { analyticsEventDedupeKey, mergeAnalyticsEventRows, type EventRow } from "../dashboard/lib/server/mergeAnalyticsEvents";

describe("mergeAnalyticsEventRows", () => {
  it("dedupes identical rows from stream and file (stream wins first)", () => {
    const row: EventRow = {
      event: "paywall_impression",
      sessionId: "s1",
      timestamp: 1,
      feature: "pdf_export",
      source: "modal"
    };
    const merged = mergeAnalyticsEventRows([row], [row]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual(row);
  });

  it("keeps distinct rows from both sources", () => {
    const a: EventRow = { event: "a", sessionId: "1", timestamp: 1 };
    const b: EventRow = { event: "b", sessionId: "2", timestamp: 2 };
    const merged = mergeAnalyticsEventRows([a], [b]);
    expect(merged).toHaveLength(2);
  });

  it("analyticsEventDedupeKey differentiates events", () => {
    const r1: EventRow = { event: "x", sessionId: "s", timestamp: 5 };
    const r2: EventRow = { event: "y", sessionId: "s", timestamp: 5 };
    expect(analyticsEventDedupeKey(r1)).not.toBe(analyticsEventDedupeKey(r2));
  });
});
