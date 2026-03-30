export type EventRow = {
  event: string;
  source?: string;
  feature?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
};

function norm(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.trim();
}

/** Stable key so dual-write (file + Redis stream) does not double-count. */
export function analyticsEventDedupeKey(row: EventRow): string {
  return `${row.timestamp}|${norm(row.sessionId)}|${row.event}|${norm(row.feature)}|${norm(row.source)}`;
}

/**
 * Prefer `streamFirst` order: stream rows win on duplicate keys, then file fills historical gaps.
 */
export function mergeAnalyticsEventRows(streamRows: EventRow[], fileRows: EventRow[]): EventRow[] {
  const seen = new Set<string>();
  const out: EventRow[] = [];
  for (const r of streamRows) {
    const k = analyticsEventDedupeKey(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  for (const r of fileRows) {
    const k = analyticsEventDedupeKey(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}
