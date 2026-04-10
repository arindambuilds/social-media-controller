import type { NextApiRequest, NextApiResponse } from "next"

type FunnelData = {
  stages: { label: string; count: number }[]
  message?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FunnelData>
): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    res.status(405).end()
    return
  }

  try {
    const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "")
    const token = req.headers.authorization ?? ""
    const clientId = req.query.clientId as string | undefined

    const url = clientId
      ? `${apiBase}/api/analytics/funnel?clientId=${encodeURIComponent(clientId)}`
      : `${apiBase}/api/analytics/funnel`

    const upstream = await fetch(url, {
      headers: { Authorization: token },
    })

    if (!upstream.ok) {
      res.status(200).json({ stages: [], message: "Analytics temporarily unavailable" })
      return
    }

    const data = (await upstream.json()) as FunnelData
    res.status(200).json(data)
  } catch (error) {
    console.warn("Funnel analytics proxy failed:", error)
    res.status(200).json({ stages: [], message: "Analytics temporarily unavailable" })
  }
}
