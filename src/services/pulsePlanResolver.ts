import type { PulseTier } from "../config/pulseTiers";
import { PULSE_PLAN_ALIASES } from "../config/pulseTiers";

/**
 * Resolves subscription tier for briefing depth and upgrade copy.
 * Unknown paid-looking strings default to `normal` so paying users still get a briefing.
 */
export function mapUserPlanToPulseTier(plan: string | null | undefined): PulseTier {
  const key = (plan ?? "free").trim().toLowerCase();
  if (!key || key === "free") return "free";
  const mapped = PULSE_PLAN_ALIASES[key];
  if (mapped) return mapped;
  if (key.includes("elite") || key.includes("agency")) return "elite";
  if (key.includes("standard") || key.includes("growth") || key.includes("pro")) return "standard";
  if (key.includes("normal") || key.includes("starter") || key.includes("plus")) return "normal";
  return "normal";
}
