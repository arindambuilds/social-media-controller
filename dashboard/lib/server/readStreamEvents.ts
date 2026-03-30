import type Redis from "ioredis";
import { ANALYTICS_EVENTS_STREAM } from "./analyticsRedis";
import type { EventRow } from "./mergeAnalyticsEvents";

function fieldValue(fields: string[], name: string): string | null {
  for (let i = 0; i < fields.length - 1; i += 2) {
    if (fields[i] === name) return fields[i + 1] ?? null;
  }
  return null;
}

/** XRANGE bounded read for funnel aggregation (trimmed stream MAXLEN ~50k on write). */
export async function readAnalyticsEventsFromStream(redis: Redis): Promise<EventRow[]> {
  await redis.connect().catch(() => {});
  const raw = await redis.xrange(ANALYTICS_EVENTS_STREAM, "-", "+", "COUNT", 100_000);
  const out: EventRow[] = [];
  for (const [, fields] of raw) {
    const payload = fieldValue(fields, "payload");
    if (!payload) continue;
    try {
      const row = JSON.parse(payload) as EventRow;
      if (typeof row.event === "string" && typeof row.timestamp === "number") {
        out.push(row);
      }
    } catch {
      /* skip corrupt */
    }
  }
  return out;
}
