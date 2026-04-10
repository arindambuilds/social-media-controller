import type { NextApiRequest, NextApiResponse } from "next"
import { getAnalyticsRedis, ANALYTICS_EVENTS_STREAM } from "@/lib/server/analyticsRedis"
import type { AnalyticsEventPayload } from "../../utils/analytics"

const DEFAULT_LOCAL_API_ORIGIN = "http://localhost:4000"
const DEFAULT_PRODUCTION_API_ORIGIN = "https://social-media-controller.onrender.com"

function apiBase(): string {
  const raw = (
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    (process.env.NODE_ENV === "production" ? DEFAULT_PRODUCTION_API_ORIGIN : DEFAULT_LOCAL_API_ORIGIN)
  ).replace(/\/$/, "")
  return raw.endsWith("/api") ? raw.slice(0, -4) : raw
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method === "POST") {
    // Handle analytics event tracking
    const redis = getAnalyticsRedis()
    if (!redis) {
      // Fallback: silently drop events if Redis unavailable
      res.status(200).json({ success: true })
      return
    }

    try {
      const payload: AnalyticsEventPayload = req.body
      if (!payload.event || typeof payload.timestamp !== "number") {
        res.status(400).json({ error: "Invalid event payload" })
        return
      }

      // Write to Redis stream (non-blocking, no fs lock, with maxlen to prevent unbounded growth)
      await redis.xadd(
        ANALYTICS_EVENTS_STREAM,
        "MAXLEN",
        "~",
        "50000", // Keep ~50k recent events
        "*",
        "payload",
        JSON.stringify(payload)
      )

      res.status(200).json({ success: true })
    } catch (error) {
      console.warn("Analytics event write failed:", error)
      res.status(500).json({ error: "Failed to record event" })
    }
    return
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, POST")
    res.status(405).json({ error: "Method not allowed" })
    return
  }

  // Existing GET logic for overview proxy
  const { clientId, platform, period } = req.query
  if (!clientId) {
    res.status(400).json({ error: "clientId is required" })
    return
  }

  const auth = req.headers.authorization
  if (!auth) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }

  try {
    const params = new URLSearchParams()
    if (platform) params.set("platform", String(platform))
    if (period) params.set("period", String(period))

    const upstream = await fetch(
      `${apiBase()}/api/analytics/${clientId}/overview?${params}`,
      { headers: { Authorization: auth } }
    )
    const data = await upstream.json()
    res.status(upstream.status).json(data)
  } catch {
    res.status(502).json({ error: "Analytics service unavailable" })
  }
}

