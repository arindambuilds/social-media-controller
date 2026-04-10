import type { NextApiRequest, NextApiResponse } from "next"
import { prisma } from "@/lib/server/prisma"

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
    const events = await prisma.analyticsEvent.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // last 30 days
        eventType: { in: ['page_view', 'upgrade_click', 'checkout_started', 'payment_success'] },
      },
      select: { eventType: true, createdAt: true, userId: true },
      orderBy: { createdAt: 'asc' },
    });

    // Simple funnel: page_view -> upgrade_clicked -> checkout_started -> payment_success
    const stages = [
      { label: "Page Views", count: events.filter(e => e.eventType === "page_view").length },
      { label: "Upgrade Clicks", count: events.filter(e => e.eventType === "upgrade_click").length },
      { label: "Checkout Started", count: events.filter(e => e.eventType === "checkout_started").length },
      { label: "Payment Success", count: events.filter(e => e.eventType === "payment_success").length }
    ]

    res.status(200).json({ stages })
  } catch (error) {
    console.warn("Funnel analytics failed:", error)
    res.status(200).json({
      stages: [],
      message: "Analytics temporarily unavailable"
    })
  }
}

