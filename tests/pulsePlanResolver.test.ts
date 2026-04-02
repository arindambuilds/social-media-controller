import { describe, expect, it } from "vitest";
import { mapUserPlanToPulseTier } from "../src/services/pulsePlanResolver";

describe("mapUserPlanToPulseTier", () => {
  it("maps Stripe-style ids", () => {
    expect(mapUserPlanToPulseTier("starter")).toBe("normal");
    expect(mapUserPlanToPulseTier("growth")).toBe("standard");
    expect(mapUserPlanToPulseTier("agency")).toBe("elite");
  });

  it("maps explicit Pulse ids", () => {
    expect(mapUserPlanToPulseTier("pulse_normal")).toBe("normal");
    expect(mapUserPlanToPulseTier("pulse_standard")).toBe("standard");
    expect(mapUserPlanToPulseTier("pulse_elite")).toBe("elite");
  });

  it("treats empty as free", () => {
    expect(mapUserPlanToPulseTier(null)).toBe("free");
    expect(mapUserPlanToPulseTier("")).toBe("free");
    expect(mapUserPlanToPulseTier("free")).toBe("free");
  });
});
