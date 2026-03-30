import { describe, expect, it } from "vitest";
import {
  AGENCY_LONG_WAIT_BOOST,
  computeFairPdfQueuePriority,
  inferPdfRoleBaseFromStoredPriority,
  PDF_FAIR_MAX_WAIT_SEC,
  PDF_FAIR_TIER_AGENCY,
  PDF_FAIR_TIER_CLIENT,
  PDF_FAIR_TIER_DEFAULT,
  pdfJobTierForRole
} from "../src/lib/pdfFairPriority";

describe("pdfFairPriority", () => {
  it("pdfJobTierForRole maps prisma roles", () => {
    expect(pdfJobTierForRole("AGENCY_ADMIN")).toBe(PDF_FAIR_TIER_AGENCY);
    expect(pdfJobTierForRole("CLIENT_USER")).toBe(PDF_FAIR_TIER_CLIENT);
    expect(pdfJobTierForRole(undefined)).toBe(PDF_FAIR_TIER_DEFAULT);
  });

  it("computeFairPdfQueuePriority grows with wait and respects tier at t=0", () => {
    const t0 = 1_700_000_000_000;
    expect(computeFairPdfQueuePriority(PDF_FAIR_TIER_AGENCY, t0, t0)).toBe(30_000);
    expect(computeFairPdfQueuePriority(PDF_FAIR_TIER_DEFAULT, t0, t0)).toBe(3000);
    const t60 = t0 + 60_000;
    const freeAfter60 = computeFairPdfQueuePriority(PDF_FAIR_TIER_DEFAULT, t0, t60);
    const agencyFresh = computeFairPdfQueuePriority(PDF_FAIR_TIER_AGENCY, t60, t60);
    expect(freeAfter60).toBeGreaterThan(agencyFresh);
  });

  it("caps wait contribution at PDF_FAIR_MAX_WAIT_SEC", () => {
    const start = 0;
    const far = start + (PDF_FAIR_MAX_WAIT_SEC + 120) * 1000;
    const capped = computeFairPdfQueuePriority(PDF_FAIR_TIER_DEFAULT, start, far);
    const atCap = computeFairPdfQueuePriority(PDF_FAIR_TIER_DEFAULT, start, start + PDF_FAIR_MAX_WAIT_SEC * 1000);
    expect(capped).toBe(atCap);
  });

  it("agency tier gets extra priority after 2+ minutes wait", () => {
    const t0 = 1_800_000_000_000;
    const shortWait = computeFairPdfQueuePriority(PDF_FAIR_TIER_AGENCY, t0, t0);
    const longWait = computeFairPdfQueuePriority(PDF_FAIR_TIER_AGENCY, t0, t0 + 121_000);
    expect(longWait - shortWait).toBe(700 * 121 + AGENCY_LONG_WAIT_BOOST);
    const clientLong = computeFairPdfQueuePriority(PDF_FAIR_TIER_CLIENT, t0, t0 + 121_000);
    expect(clientLong).toBeLessThan(longWait);
  });

  it("inferPdfRoleBaseFromStoredPriority handles legacy and fair encodings", () => {
    expect(inferPdfRoleBaseFromStoredPriority(100)).toBe(PDF_FAIR_TIER_AGENCY);
    expect(inferPdfRoleBaseFromStoredPriority(50)).toBe(PDF_FAIR_TIER_CLIENT);
    expect(inferPdfRoleBaseFromStoredPriority(10)).toBe(PDF_FAIR_TIER_DEFAULT);
    expect(inferPdfRoleBaseFromStoredPriority(30_000)).toBe(PDF_FAIR_TIER_AGENCY);
    expect(inferPdfRoleBaseFromStoredPriority(15_000)).toBe(PDF_FAIR_TIER_CLIENT);
    expect(inferPdfRoleBaseFromStoredPriority(3000)).toBe(PDF_FAIR_TIER_DEFAULT);
    expect(inferPdfRoleBaseFromStoredPriority(3000 + 700 * 40)).toBe(PDF_FAIR_TIER_DEFAULT);
    const t0 = 1_800_000_000_000;
    const agencyLongScore = computeFairPdfQueuePriority(PDF_FAIR_TIER_AGENCY, t0, t0 + 121_000);
    expect(inferPdfRoleBaseFromStoredPriority(agencyLongScore)).toBe(PDF_FAIR_TIER_AGENCY);
  });
});
