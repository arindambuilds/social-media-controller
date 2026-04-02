/**
 * PulseOS pricing tiers (WhatsApp daily briefing depth + growth nudges).
 * Maps to `User.plan` via `mapUserPlanToPulseTier`.
 */
export type PulseTier = "free" | "normal" | "standard" | "elite";

export const PULSE_TIER_INR: Record<Exclude<PulseTier, "free">, number> = {
  normal: 1199,
  standard: 3000,
  elite: 5000
};

export const PULSE_TIER_LABEL: Record<PulseTier, string> = {
  free: "Free",
  normal: "Normal",
  standard: "Standard",
  elite: "Elite"
};

/** Stripe / internal plan ids → canonical tier (extend as products evolve). */
export const PULSE_PLAN_ALIASES: Record<string, PulseTier> = {
  free: "free",
  starter: "normal",
  growth: "standard",
  agency: "elite",
  pulse_normal: "normal",
  pulse_standard: "standard",
  pulse_elite: "elite",
  normal: "normal",
  standard: "standard",
  elite: "elite"
};
