import type { NextApiRequest, NextApiResponse } from "next"

type FunnelData = {
  stages: { label: string; count: number }[]
  message?: string
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<FunnelData>
): void {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    res.status(405).end()
    return
  }
  // TODO: implement funnel analytics via backend API when ready
  res.status(200).json({
    stages: [],
    message: "Funnel analytics coming soon",
  })
}

