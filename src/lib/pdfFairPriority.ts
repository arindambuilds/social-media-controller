/**
 * Fair-ish PDF ordering for BullMQ: **larger priority score = sooner** (see `getPriorityScore` in BullMQ).
 * Combines a small role tier with **wait time** so low-tier jobs are not starved by a flood of agency jobs.
 *
 * score ≈ 0.3 × tier + 0.7 × min(waitSec, cap) — scaled ×1000 → integers.
 */

export const PDF_FAIR_TIER_AGENCY = 100;
export const PDF_FAIR_TIER_CLIENT = 50;
export const PDF_FAIR_TIER_DEFAULT = 10;

const TIER_WEIGHT = 300;
const WAIT_WEIGHT = 700;
/** Cap wait contribution (~15 min) so scores stay bounded and below BullMQ’s priority ceiling. */
export const PDF_FAIR_MAX_WAIT_SEC = 900;

/** Extra BullMQ score for agency-tier jobs waiting ≥2 min (reduces stuck-agency backlog under load). */
export const AGENCY_LONG_WAIT_BOOST = 15_000;
const AGENCY_LONG_WAIT_SEC = 120;

const LEGACY_MAX_PRIORITY = 100;

export function pdfJobTierForRole(role: string | undefined): number {
  if (role === "AGENCY_ADMIN") return PDF_FAIR_TIER_AGENCY;
  if (role === "CLIENT_USER") return PDF_FAIR_TIER_CLIENT;
  return PDF_FAIR_TIER_DEFAULT;
}

/**
 * @param tier — `pdfJobTierForRole` value (10 / 50 / 100)
 * @param enqueuedAtMs — wall clock when the job was added
 */
export function computeFairPdfQueuePriority(
  tier: number,
  enqueuedAtMs: number,
  nowMs: number = Date.now()
): number {
  const waitSec = Math.max(0, Math.min(PDF_FAIR_MAX_WAIT_SEC, Math.floor((nowMs - enqueuedAtMs) / 1000)));
  let score = Math.floor(TIER_WEIGHT * tier + WAIT_WEIGHT * waitSec);
  if (tier >= PDF_FAIR_TIER_AGENCY && waitSec >= AGENCY_LONG_WAIT_SEC) {
    score += AGENCY_LONG_WAIT_BOOST;
  }
  return score;
}

/**
 * Jobs enqueued before `pdfRoleBase` existed: legacy BullMQ priority was literally 100 / 50 / 10.
 * Fair encoding is `300 * tier + 700 * waitSec` (integer waitSec).
 */
export function inferPdfRoleBaseFromStoredPriority(priority: number | undefined): number {
  const p = priority ?? PDF_FAIR_TIER_DEFAULT;
  if (p <= LEGACY_MAX_PRIORITY) {
    if (p >= PDF_FAIR_TIER_AGENCY) return PDF_FAIR_TIER_AGENCY;
    if (p >= PDF_FAIR_TIER_CLIENT) return PDF_FAIR_TIER_CLIENT;
    return PDF_FAIR_TIER_DEFAULT;
  }
  for (const tier of [PDF_FAIR_TIER_AGENCY, PDF_FAIR_TIER_CLIENT, PDF_FAIR_TIER_DEFAULT]) {
    const extras = tier >= PDF_FAIR_TIER_AGENCY ? [0, AGENCY_LONG_WAIT_BOOST] : [0];
    for (const extra of extras) {
      const rem = p - TIER_WEIGHT * tier - extra;
      if (rem < 0) continue;
      const waitSec = rem / WAIT_WEIGHT;
      if (waitSec !== Math.floor(waitSec) || waitSec > PDF_FAIR_MAX_WAIT_SEC) continue;
      if (tier >= PDF_FAIR_TIER_AGENCY && waitSec >= AGENCY_LONG_WAIT_SEC && extra !== AGENCY_LONG_WAIT_BOOST) {
        continue;
      }
      if (tier >= PDF_FAIR_TIER_AGENCY && waitSec < AGENCY_LONG_WAIT_SEC && extra !== 0) {
        continue;
      }
      return tier;
    }
  }
  return PDF_FAIR_TIER_DEFAULT;
}
