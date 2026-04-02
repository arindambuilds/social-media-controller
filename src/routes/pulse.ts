import type { Request } from "express";
import { Router } from "express";
import { z } from "zod";
import { PULSE_TIER_INR, PULSE_TIER_LABEL, type PulseTier } from "../config/pulseTiers";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { tenantRateLimit } from "../middleware/tenantRateLimit";
import { mapUserPlanToPulseTier } from "../services/pulsePlanResolver";

export const pulseRouter = Router();

pulseRouter.use(authenticate);
pulseRouter.use(tenantRateLimit);

async function agencyCanTouchClient(userId: string, clientId: string): Promise<boolean> {
  const row = await prisma.client.findFirst({
    where: {
      id: clientId,
      OR: [{ agencyId: userId }, { ownerId: userId }]
    },
    select: { id: true }
  });
  return !!row;
}

function resolveClientId(
  req: Request,
  bodyClientId?: string
): { ok: true; clientId: string } | { ok: false; status: number; error: string } {
  const role = req.auth!.role;
  if (role === "CLIENT_USER") {
    if (!req.auth!.clientId) {
      return { ok: false, status: 400, error: "No client assigned to this account." };
    }
    return { ok: true, clientId: req.auth!.clientId };
  }
  const qRaw = req.query.clientId;
  const q =
    typeof qRaw === "string" && qRaw.trim()
      ? qRaw.trim()
      : Array.isArray(qRaw) && typeof qRaw[0] === "string" && qRaw[0].trim()
        ? qRaw[0].trim()
        : undefined;
  const fromBody = bodyClientId?.trim();
  const cid = fromBody || q;
  if (!cid) {
    return { ok: false, status: 400, error: "Query or body clientId is required for agency users." };
  }
  return { ok: true, clientId: cid };
}

function parseMetricsTracked(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((s) => s.trim());
}

const onboardingBodySchema = z
  .object({
    clientId: z.string().optional(),
    businessType: z.string().min(1).max(80).optional(),
    metricsTracked: z.array(z.string().min(1).max(64)).max(24).optional()
  })
  .refine((d) => d.businessType != null || d.metricsTracked != null, {
    message: "Provide businessType and/or metricsTracked"
  });

/** Product + WhatsApp template summaries for pricing UI. */
pulseRouter.get("/tiers", (_req, res) => {
  const tiers: Array<{
    id: Exclude<PulseTier, "free">;
    label: string;
    inr: number;
    whatsappTemplate: string;
  }> = [
    {
      id: "normal",
      label: PULSE_TIER_LABEL.normal,
      inr: PULSE_TIER_INR.normal,
      whatsappTemplate:
        "YESTERDAY: followers + leads + likes + comments (compact). One short INSIGHT. Optional upgrade line for week trends."
    },
    {
      id: "standard",
      label: PULSE_TIER_LABEL.standard,
      inr: PULSE_TIER_INR.standard,
      whatsappTemplate:
        "YESTERDAY + WEEK TREND (leads 7d vs prior 7d). INSIGHT with one concrete suggestion. Streak line when ≥2 days."
    },
    {
      id: "elite",
      label: PULSE_TIER_LABEL.elite,
      inr: PULSE_TIER_INR.elite,
      whatsappTemplate:
        "Full yesterday + 7d lead trend + follower net 7d. INSIGHT + performance ALERT if engagement dips. “What to do next”, streak, weekly momentum, upgrade nudges capped."
    }
  ];
  res.json({ tiers });
});

pulseRouter.get("/client/summary", async (req, res) => {
  const resolved = resolveClientId(req);
  if (!resolved.ok) {
    res.status(resolved.status).json({ error: resolved.error });
    return;
  }
  if (req.auth!.role !== "CLIENT_USER") {
    const ok = await agencyCanTouchClient(req.auth!.userId, resolved.clientId);
    if (!ok) {
      res.status(403).json({ error: "Forbidden for this client." });
      return;
    }
  }

  const row = await prisma.client.findFirst({
    where: { id: resolved.clientId },
    select: {
      businessType: true,
      metricsTrackedJson: true,
      onboardingCompletedAt: true,
      briefingStreakCurrent: true,
      briefingStreakBest: true,
      owner: { select: { plan: true } }
    }
  });
  if (!row) {
    res.status(404).json({ error: "Client not found." });
    return;
  }

  const tier = mapUserPlanToPulseTier(row.owner.plan);
  const lastBriefing = await prisma.briefing.findFirst({
    where: { clientId: resolved.clientId },
    orderBy: { sentAt: "desc" },
    select: { sentAt: true, whatsappDelivered: true, emailDelivered: true, pulseTierSnapshot: true }
  });

  let upgradeHint: string | null = null;
  if (tier === "free" || tier === "normal") {
    upgradeHint = `Standard (₹${PULSE_TIER_INR.standard.toLocaleString("en-IN")}/mo) adds week-over-week lead trends and deeper tips.`;
  } else if (tier === "standard") {
    upgradeHint = `Elite (₹${PULSE_TIER_INR.elite.toLocaleString("en-IN")}/mo) adds alerts, lead prioritisation copy, and priority delivery options.`;
  }

  res.json({
    clientId: resolved.clientId,
    pulseTier: tier,
    businessType: row.businessType,
    metricsTracked: parseMetricsTracked(row.metricsTrackedJson),
    onboardingCompletedAt: row.onboardingCompletedAt?.toISOString() ?? null,
    streak: { current: row.briefingStreakCurrent, best: row.briefingStreakBest },
    lastBriefing: lastBriefing
      ? {
          sentAt: lastBriefing.sentAt.toISOString(),
          whatsappDelivered: lastBriefing.whatsappDelivered,
          emailDelivered: lastBriefing.emailDelivered,
          pulseTierSnapshot: lastBriefing.pulseTierSnapshot
        }
      : null,
    upgradeHint
  });
});

pulseRouter.get("/client/briefings", async (req, res) => {
  const resolved = resolveClientId(req);
  if (!resolved.ok) {
    res.status(resolved.status).json({ error: resolved.error });
    return;
  }
  if (req.auth!.role !== "CLIENT_USER") {
    const ok = await agencyCanTouchClient(req.auth!.userId, resolved.clientId);
    if (!ok) {
      res.status(403).json({ error: "Forbidden for this client." });
      return;
    }
  }

  const rawLimit = req.query.limit;
  const n = typeof rawLimit === "string" ? Number(rawLimit) : Array.isArray(rawLimit) ? Number(rawLimit[0]) : 7;
  const limit = Number.isFinite(n) ? Math.min(30, Math.max(1, Math.floor(n))) : 7;

  const rows = await prisma.briefing.findMany({
    where: { clientId: resolved.clientId },
    orderBy: { sentAt: "desc" },
    take: limit,
    select: {
      id: true,
      sentAt: true,
      whatsappDelivered: true,
      emailDelivered: true,
      pulseTierSnapshot: true,
      tipText: true
    }
  });

  res.json({
    briefings: rows.map((b) => ({
      id: b.id,
      sentAt: b.sentAt.toISOString(),
      whatsappDelivered: b.whatsappDelivered,
      emailDelivered: b.emailDelivered,
      pulseTierSnapshot: b.pulseTierSnapshot,
      tipPreview: b.tipText ? (b.tipText.length > 140 ? `${b.tipText.slice(0, 137)}…` : b.tipText) : null
    }))
  });
});

pulseRouter.patch("/client/onboarding", async (req, res) => {
  const parsed = onboardingBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const resolved = resolveClientId(req, parsed.data.clientId);
  if (!resolved.ok) {
    res.status(resolved.status).json({ error: resolved.error });
    return;
  }
  if (req.auth!.role !== "CLIENT_USER") {
    const ok = await agencyCanTouchClient(req.auth!.userId, resolved.clientId);
    if (!ok) {
      res.status(403).json({ error: "Forbidden for this client." });
      return;
    }
  }

  const { businessType, metricsTracked } = parsed.data;
  await prisma.client.update({
    where: { id: resolved.clientId },
    data: {
      ...(businessType !== undefined ? { businessType } : {}),
      ...(metricsTracked !== undefined ? { metricsTrackedJson: metricsTracked } : {}),
      onboardingCompletedAt: new Date()
    }
  });

  res.json({ ok: true, clientId: resolved.clientId });
});

/** Optional: call when user opens dashboard briefing tab (habit tracking / future analytics). */
pulseRouter.post("/client/engagement/briefing-opened", async (req, res) => {
  const resolved = resolveClientId(req, typeof req.body?.clientId === "string" ? req.body.clientId : undefined);
  if (!resolved.ok) {
    res.status(resolved.status).json({ error: resolved.error });
    return;
  }
  if (req.auth!.role !== "CLIENT_USER") {
    const ok = await agencyCanTouchClient(req.auth!.userId, resolved.clientId);
    if (!ok) {
      res.status(403).json({ error: "Forbidden for this client." });
      return;
    }
  }
  res.status(204).send();
});
