import type { PulseTier } from "../config/pulseTiers";
import { prisma } from "../lib/prisma";
import type { BriefingData } from "./briefingData";
import { istDayRangeUtc, istYmd } from "./briefingData";

const MS_PER_DAY = 86400000;

function istAddCalendarDays(ymd: string, deltaDays: number): string {
  const { start } = istDayRangeUtc(ymd);
  const shifted = new Date(start.getTime() + deltaDays * 86400000);
  return istYmd(shifted);
}

/** Streak including today’s briefing (IST), before persisting the new `lastDate`. */
export function computeStreakAfterBriefing(lastDateIst: string | null, currentStreak: number): number {
  const todayIst = istYmd(new Date());
  if (lastDateIst === todayIst) return currentStreak;
  const yesterdayIst = istAddCalendarDays(todayIst, -1);
  if (lastDateIst === yesterdayIst) return currentStreak + 1;
  return 1;
}

/**
 * Call once per calendar day when a briefing is generated (IST), after DB persistence.
 * Returns the streak the user has *including* today’s delivery.
 */
export async function onPulseBriefingSent(clientId: string): Promise<{ streakAfter: number; streakBest: number }> {
  const todayIst = istYmd(new Date());
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      briefingStreakLastDateIst: true,
      briefingStreakCurrent: true,
      briefingStreakBest: true
    }
  });
  if (!client) return { streakAfter: 0, streakBest: 0 };

  if (client.briefingStreakLastDateIst === todayIst) {
    return { streakAfter: client.briefingStreakCurrent, streakBest: client.briefingStreakBest };
  }

  const next = computeStreakAfterBriefing(client.briefingStreakLastDateIst, client.briefingStreakCurrent);
  const best = Math.max(client.briefingStreakBest, next);

  await prisma.client.update({
    where: { id: clientId },
    data: {
      briefingStreakLastDateIst: todayIst,
      briefingStreakCurrent: next,
      briefingStreakBest: best
    }
  });

  return { streakAfter: next, streakBest: best };
}

export function formatStreakLine(streakAfter: number): string | null {
  if (streakAfter < 2) return null;
  return `🔥 Streak: ${streakAfter} days in a row on Pulse — great habit.`;
}

export function formatWeeklyMomentumLine(
  tier: PulseTier,
  leadsLast7d: number | undefined,
  leadsPrev7d: number | undefined
): string | null {
  if (tier !== "elite" && tier !== "standard") return null;
  if (leadsLast7d == null || leadsPrev7d == null) return null;
  if (leadsLast7d === 0 && leadsPrev7d === 0) return null;
  const base = Math.max(leadsPrev7d, 1);
  const pct = Math.round(((leadsLast7d - leadsPrev7d) / base) * 100);
  if (Math.abs(pct) < 8) return null;
  return pct > 0
    ? `📊 Week vs prior week: leads up ~${pct}% — strong pipeline.`
    : `📊 Week vs prior week: leads down ~${Math.abs(pct)}% — tighten one acquisition action today.`;
}

/** At most ~1× per 6 days when copy is non-empty; supports retention + upgrade narrative. */
export async function maybeWeeklyRetentionLine(
  clientId: string,
  tier: PulseTier,
  data: BriefingData
): Promise<string | null> {
  if (tier !== "elite" && tier !== "standard") return null;
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { lastWeeklySummaryAt: true }
  });
  if (!client) return null;
  if (client.lastWeeklySummaryAt && Date.now() - client.lastWeeklySummaryAt.getTime() < 6 * MS_PER_DAY) {
    return null;
  }
  const line = formatWeeklyMomentumLine(tier, data.leadsLast7d, data.leadsPrev7d);
  if (line) {
    await prisma.client.update({
      where: { id: clientId },
      data: { lastWeeklySummaryAt: new Date() }
    });
  }
  return line;
}
