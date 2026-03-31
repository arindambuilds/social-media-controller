/**
 * Verbose briefing / WhatsApp pipeline logs for first live E2E and debugging.
 * Set `DEBUG_BRIEFING=1` (or `true`) in the process environment.
 */
export function isDebugBriefing(): boolean {
  const v = process.env.DEBUG_BRIEFING?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}
