import type { NextApiRequest, NextApiResponse } from "next";
import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";
import { ANALYTICS_EVENTS_STREAM, getAnalyticsRedis } from "../../lib/server/analyticsRedis";

type AnalyticsEventPayload = {
  event: string;
  userId?: string;
  sessionId: string;
  source?: string;
  feature?: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parsePayload(body: unknown): AnalyticsEventPayload | null {
  if (!isRecord(body)) return null;
  if (typeof body.event !== "string" || !body.event.trim()) return null;
  if (typeof body.sessionId !== "string" || !body.sessionId.trim()) return null;
  if (typeof body.timestamp !== "number" || !Number.isFinite(body.timestamp)) return null;
  if (body.userId != null && typeof body.userId !== "string") return null;
  if (body.source != null && typeof body.source !== "string") return null;
  if (body.feature != null && typeof body.feature !== "string") return null;
  if (body.metadata != null && !isRecord(body.metadata)) return null;

  return {
    event: body.event.trim(),
    userId: typeof body.userId === "string" ? body.userId : undefined,
    sessionId: body.sessionId.trim(),
    source: typeof body.source === "string" ? body.source : undefined,
    feature: typeof body.feature === "string" ? body.feature : undefined,
    metadata: isRecord(body.metadata) ? body.metadata : undefined,
    timestamp: body.timestamp
  };
}

async function persistEvent(payload: AnalyticsEventPayload): Promise<void> {
  const dir = path.join(process.cwd(), ".analytics");
  const file = path.join(dir, "events.ndjson");
  const line = `${JSON.stringify(payload)}\n`;
  await mkdir(dir, { recursive: true });
  await appendFile(file, line, "utf8");

  const redis = getAnalyticsRedis();
  if (!redis) return;

  try {
    await redis.connect().catch(() => {});
    await redis.xadd(
      ANALYTICS_EVENTS_STREAM,
      "MAXLEN",
      "~",
      "50000",
      "*",
      "payload",
      JSON.stringify(payload)
    );
  } catch (err) {
    console.warn(
      JSON.stringify({
        level: "WARN",
        msg: "analytics_redis_stream_failed_ndjson_ok",
        error: err instanceof Error ? err.message : String(err)
      })
    );
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const parsed = parsePayload(req.body);
  if (!parsed) {
    res.status(400).json({ error: "Invalid analytics payload" });
    return;
  }

  try {
    await persistEvent(parsed);
    res.status(202).json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to persist analytics event" });
  }
}

