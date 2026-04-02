import type { PulseTier } from "../config/pulseTiers";
import { PULSE_TIER_INR } from "../config/pulseTiers";
import { prisma } from "../lib/prisma";
import type { BriefingData } from "./briefingData";

const MS_PER_DAY = 86400000;

async function wasNudgeSentWithinDays(clientId: string, nudgeKey: string, days: number): Promise<boolean> {
  const since = new Date(Date.now() - days * MS_PER_DAY);
  const row = await prisma.pulseNudgeLog.findFirst({
    where: { clientId, nudgeKey, createdAt: { gte: since } },
    select: { id: true }
  });
  return !!row;
}

async function logNudge(clientId: string, nudgeKey: string, metadata?: Record<string, unknown>): Promise<void> {
  await prisma.pulseNudgeLog.create({
    data: {
      clientId,
      nudgeKey,
      channel: "whatsapp",
      metadata: metadata ? (metadata as object) : undefined
    }
  });
}

/**
 * Short WhatsApp appendix lines (max 2) to drive upgrades without bloating the briefing.
 */
export async function getPulseUpgradeAppendix(
  clientId: string,
  tier: PulseTier,
  data: BriefingData
): Promise<string[]> {
  const lines: string[] = [];

  if (tier === "free" || tier === "normal") {
    const highLeads = data.newLeads >= 3;
    if (highLeads && !(await wasNudgeSentWithinDays(clientId, "upsell_standard_leads", 5))) {
      lines.push(
        `💡 You had ${data.newLeads} new leads yesterday. Standard (₹${PULSE_TIER_INR.standard.toLocaleString("en-IN")}/mo) adds week trends + clearer next steps — open Billing in Pulse.`
      );
      await logNudge(clientId, "upsell_standard_leads", { newLeads: data.newLeads });
    } else if (
      data.avgLikesPrior7d != null &&
      data.avgLikesPrior7d >= 8 &&
      data.likesYesterday < Math.round(data.avgLikesPrior7d * 0.82)
    ) {
      if (!(await wasNudgeSentWithinDays(clientId, "upsell_standard_engagement_drop", 7))) {
        const pct = Math.round((1 - data.likesYesterday / data.avgLikesPrior7d) * 100);
        lines.push(
          `📉 Engagement dipped ~${pct}% vs your recent average — unlock trend insights on Standard (₹${PULSE_TIER_INR.standard.toLocaleString("en-IN")}/mo).`
        );
        await logNudge(clientId, "upsell_standard_engagement_drop", { pct });
      }
    }
  }

  if (tier === "standard") {
    const missedElite =
      data.newLeads >= 5 &&
      data.leadsLast7d != null &&
      data.leadsPrev7d != null &&
      data.leadsLast7d > data.leadsPrev7d * 1.2;
    if (missedElite && !(await wasNudgeSentWithinDays(clientId, "upsell_elite_momentum", 6))) {
      lines.push(
        `🚀 Strong lead momentum this week. Elite (₹${PULSE_TIER_INR.elite.toLocaleString("en-IN")}/mo) adds lead prioritisation, alerts, and priority delivery.`
      );
      await logNudge(clientId, "upsell_elite_momentum");
    }
  }

  return lines.slice(0, 2);
}

export function elitePerformanceAlertLine(data: BriefingData): string | null {
  if (data.avgLikesPrior7d == null || data.avgLikesPrior7d < 10) return null;
  if (data.likesYesterday >= data.avgLikesPrior7d * 0.82) return null;
  const pct = Math.round((1 - data.likesYesterday / data.avgLikesPrior7d) * 100);
  return `⚠️ Alert: yesterday’s likes ran ~${pct}% below your 7-day norm — worth double-checking posting time & hooks.`;
}
