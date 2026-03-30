import type { NextApiRequest, NextApiResponse } from "next";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { getAnalyticsRedis } from "../../../lib/server/analyticsRedis";
import { mergeAnalyticsEventRows, type EventRow } from "../../../lib/server/mergeAnalyticsEvents";
import { readAnalyticsEventsFromStream } from "../../../lib/server/readStreamEvents";

type ConversionRow = {
  source?: string | null;
  feature?: string | null;
  revenue: number;
  timestamp: number;
};

type StepCounts = {
  paywall_impression: number;
  upgrade_click: number;
  checkout_started: number;
  payment_success: number;
};

const ANALYTICS_DIR = path.join(process.cwd(), ".analytics");
const EVENTS_FILE = path.join(ANALYTICS_DIR, "events.ndjson");
const CONVERSIONS_FILE = path.join(ANALYTICS_DIR, "conversions.ndjson");

function safeRate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return (numerator / denominator) * 100;
}

function pct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function normalizeValue(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const v = value.trim();
  return v || fallback;
}

function parseNdjson<T>(raw: string): T[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as T;
      } catch {
        return null;
      }
    })
    .filter((x): x is T => x !== null);
}

async function readNdjsonFile<T>(filePath: string): Promise<T[]> {
  try {
    await mkdir(ANALYTICS_DIR, { recursive: true });
    const raw = await readFile(filePath, "utf8");
    return parseNdjson<T>(raw);
  } catch {
    return [];
  }
}

function getStepCounts(events: EventRow[]): StepCounts {
  return events.reduce<StepCounts>(
    (acc, row) => {
      if (row.event in acc) {
        const key = row.event as keyof StepCounts;
        acc[key] += 1;
      }
      return acc;
    },
    {
      paywall_impression: 0,
      upgrade_click: 0,
      checkout_started: 0,
      payment_success: 0
    }
  );
}

function keyFromRow(row: { feature?: unknown; source?: unknown; metadata?: Record<string, unknown> }): {
  feature: string;
  source: string;
} {
  const metadata = row.metadata ?? {};
  const feature = normalizeValue(row.feature ?? metadata.feature ?? metadata.featureName, "unknown_feature");
  const source = normalizeValue(row.source ?? metadata.source, "unknown_source");
  return { feature, source };
}

function eventSessionId(row: EventRow): string | null {
  if (typeof row.sessionId === "string" && row.sessionId.trim()) return row.sessionId.trim();
  const sid = row.metadata?.sessionId;
  return typeof sid === "string" && sid.trim() ? sid.trim() : null;
}

export default async function handler(_req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const fileEvents = await readNdjsonFile<EventRow>(EVENTS_FILE);
  const redis = getAnalyticsRedis();
  const streamEvents = redis ? await readAnalyticsEventsFromStream(redis).catch(() => [] as EventRow[]) : [];
  const events = mergeAnalyticsEventRows(streamEvents, fileEvents);
  const conversions = await readNdjsonFile<ConversionRow>(CONVERSIONS_FILE);

  const funnelEvents = events.filter((e) =>
    ["paywall_impression", "upgrade_click", "checkout_started", "payment_success"].includes(e.event)
  );
  const total = getStepCounts(funnelEvents);

  const byFeature = new Map<string, StepCounts>();
  const bySource = new Map<string, StepCounts>();

  for (const row of funnelEvents) {
    const { feature, source } = keyFromRow(row);
    if (!byFeature.has(feature)) byFeature.set(feature, getStepCounts([]));
    if (!bySource.has(source)) bySource.set(source, getStepCounts([]));
    const featureCounts = byFeature.get(feature)!;
    const sourceCounts = bySource.get(source)!;
    if (row.event in featureCounts) {
      const step = row.event as keyof StepCounts;
      featureCounts[step] += 1;
      sourceCounts[step] += 1;
    }
  }

  const revenueByFeature = new Map<string, number>();
  const revenueBySource = new Map<string, number>();
  let totalRevenue = 0;
  for (const row of conversions) {
    const feature = normalizeValue(row.feature, "unknown_feature");
    const source = normalizeValue(row.source, "unknown_source");
    const revenue = Number.isFinite(row.revenue) ? row.revenue : 0;
    totalRevenue += revenue;
    revenueByFeature.set(feature, (revenueByFeature.get(feature) ?? 0) + revenue);
    revenueBySource.set(source, (revenueBySource.get(source) ?? 0) + revenue);
  }

  const featureRows = [...byFeature.entries()].map(([feature, counts]) => ({
    feature,
    counts,
    rates: {
      paywallToClickPct: safeRate(counts.upgrade_click, counts.paywall_impression),
      clickToCheckoutPct: safeRate(counts.checkout_started, counts.upgrade_click),
      checkoutToPaymentPct: safeRate(counts.payment_success, counts.checkout_started)
    },
    revenue: revenueByFeature.get(feature) ?? 0
  }));

  const sourceRows = [...bySource.entries()].map(([source, counts]) => ({
    source,
    counts,
    rates: {
      paywallToClickPct: safeRate(counts.upgrade_click, counts.paywall_impression),
      clickToCheckoutPct: safeRate(counts.checkout_started, counts.upgrade_click),
      checkoutToPaymentPct: safeRate(counts.payment_success, counts.checkout_started)
    },
    revenue: revenueBySource.get(source) ?? 0
  }));

  const topFeatureByRevenue = [...featureRows].sort((a, b) => b.revenue - a.revenue)[0] ?? null;
  const topFeatureByConv = [...featureRows].sort(
    (a, b) => b.rates.checkoutToPaymentPct - a.rates.checkoutToPaymentPct
  )[0] ?? null;

  const pdf = featureRows.find((f) => f.feature === "pdf_export");
  const ai = featureRows.find((f) => f.feature === "ai_generations");
  const ratio =
    pdf && ai && ai.rates.checkoutToPaymentPct > 0
      ? pdf.rates.checkoutToPaymentPct / ai.rates.checkoutToPaymentPct
      : 0;

  const modal = sourceRows.find((s) => /paywall/.test(s.source));
  const pricing = sourceRows.find((s) => /pricing/.test(s.source));
  const pricingLift =
    pricing && modal ? pricing.rates.checkoutToPaymentPct - modal.rates.checkoutToPaymentPct : 0;

  const insights: string[] = [];
  if (ratio > 0) {
    insights.push(`PDF export converts ${ratio.toFixed(1)}x better than AI insights.`);
  }
  if (pricingLift !== 0) {
    insights.push(
      pricingLift > 0
        ? `Pricing flow outperforms paywall by ${pricingLift.toFixed(1)} percentage points.`
        : `Paywall flow outperforms pricing by ${Math.abs(pricingLift).toFixed(1)} percentage points.`
    );
  }
  if (!insights.length && topFeatureByConv) {
    insights.push(
      `${topFeatureByConv.feature} is currently the top converting feature at ${pct(
        topFeatureByConv.rates.checkoutToPaymentPct
      )}.`
    );
  }

  const assigned = events.filter((e) => e.event === "experiment_assigned");
  const converted = events.filter((e) => e.event === "experiment_conversion");

  const experimentStats = new Map<
    string,
    Map<string, { assignedSessions: Set<string>; conversionSessions: Set<string> }>
  >();

  for (const row of assigned) {
    const experiment = normalizeValue(row.metadata?.experiment, "unknown_experiment");
    const variant = normalizeValue(row.metadata?.variant, "unknown_variant");
    const sid = eventSessionId(row);
    if (!sid) continue;
    if (!experimentStats.has(experiment)) experimentStats.set(experiment, new Map());
    const variantMap = experimentStats.get(experiment)!;
    if (!variantMap.has(variant)) {
      variantMap.set(variant, { assignedSessions: new Set<string>(), conversionSessions: new Set<string>() });
    }
    variantMap.get(variant)!.assignedSessions.add(sid);
  }

  for (const row of converted) {
    const experiment = normalizeValue(row.metadata?.experiment, "unknown_experiment");
    const variant = normalizeValue(row.metadata?.variant, "unknown_variant");
    const sid = eventSessionId(row);
    if (!sid) continue;
    if (!experimentStats.has(experiment)) experimentStats.set(experiment, new Map());
    const variantMap = experimentStats.get(experiment)!;
    if (!variantMap.has(variant)) {
      variantMap.set(variant, { assignedSessions: new Set<string>(), conversionSessions: new Set<string>() });
    }
    variantMap.get(variant)!.conversionSessions.add(sid);
  }

  const experiments = Object.fromEntries(
    [...experimentStats.entries()].map(([experiment, variants]) => [
      experiment,
      Object.fromEntries(
        [...variants.entries()].map(([variant, stats]) => {
          const assignedCount = stats.assignedSessions.size;
          const conversionsCount = [...stats.conversionSessions].filter((sid) =>
            stats.assignedSessions.has(sid)
          ).length;
          return [
            variant,
            {
              assigned: assignedCount,
              conversions: conversionsCount,
              conversionRatePct: safeRate(conversionsCount, assignedCount)
            }
          ];
        })
      )
    ])
  );

  res.status(200).json({
    totals: {
      ...total,
      rates: {
        paywallToClickPct: safeRate(total.upgrade_click, total.paywall_impression),
        clickToCheckoutPct: safeRate(total.checkout_started, total.upgrade_click),
        checkoutToPaymentPct: safeRate(total.payment_success, total.checkout_started)
      },
      revenue: totalRevenue
    },
    breakdowns: {
      byFeature: featureRows,
      bySource: sourceRows
    },
    revenue: {
      total: totalRevenue,
      perFeature: Object.fromEntries(revenueByFeature.entries()),
      topConvertingFeature: topFeatureByRevenue?.feature ?? null
    },
    experiments,
    insights
  });
}

