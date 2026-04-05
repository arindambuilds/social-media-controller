import type { NextApiRequest, NextApiResponse } from "next"

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
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    res.status(405).json({ error: "Method not allowed" })
    return
  }

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

