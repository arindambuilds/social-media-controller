import type { Request } from "express";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { tenantRateLimit } from "../middleware/tenantRateLimit";
import { runBriefingNow } from "../jobs/morningBriefing";
import { signBriefingShareToken } from "../lib/briefingShareToken";

export const briefingRouter = Router();

briefingRouter.use(authenticate);
briefingRouter.use(tenantRateLimit);

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

briefingRouter.get("/latest", async (req, res) => {
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

  const briefing = await prisma.briefing.findFirst({
    where: { clientId: resolved.clientId },
    orderBy: { sentAt: "desc" },
    select: {
      id: true,
      content: true,
      sentAt: true,
      createdAt: true,
      tipText: true,
      metricsJson: true
    }
  });

  res.json({ briefing: briefing ?? null });
});

briefingRouter.get("/record/:briefingId", async (req, res) => {
  const { briefingId } = z.object({ briefingId: z.string().min(1) }).parse(req.params);

  const row = await prisma.briefing.findUnique({
    where: { id: briefingId },
    include: { client: { select: { id: true, name: true } } }
  });

  if (!row) {
    res.status(404).json({ success: false, error: { message: "Briefing not found." } });
    return;
  }

  if (req.auth!.role === "CLIENT_USER") {
    if (req.auth!.clientId !== row.clientId) {
      res.status(403).json({ success: false, error: { message: "You do not have access to this." } });
      return;
    }
  } else {
    const ok = await agencyCanTouchClient(req.auth!.userId, row.clientId);
    if (!ok) {
      res.status(403).json({ success: false, error: { message: "You do not have access to this." } });
      return;
    }
  }

  const myFeedback = await prisma.briefingFeedback.findFirst({
    where: { briefingId, userId: req.auth!.userId }
  });

  const older = await prisma.briefing.findFirst({
    where: { clientId: row.clientId, sentAt: { lt: row.sentAt } },
    orderBy: { sentAt: "desc" },
    select: { id: true }
  });
  const newer = await prisma.briefing.findFirst({
    where: { clientId: row.clientId, sentAt: { gt: row.sentAt } },
    orderBy: { sentAt: "asc" },
    select: { id: true }
  });

  res.json({
    success: true,
    briefing: {
      id: row.id,
      clientId: row.clientId,
      businessName: row.client.name,
      content: row.content,
      tipText: row.tipText,
      metricsJson: row.metricsJson,
      status: row.status,
      sentAt: row.sentAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      whatsappDelivered: row.whatsappDelivered,
      emailDelivered: row.emailDelivered
    },
    adjacent: { olderId: older?.id ?? null, newerId: newer?.id ?? null },
    myFeedback: myFeedback
      ? { tipRating: myFeedback.tipRating, freeText: myFeedback.freeText }
      : null
  });
});

briefingRouter.post("/record/:briefingId/feedback", async (req, res) => {
  const { briefingId } = z.object({ briefingId: z.string().min(1) }).parse(req.params);
  const body = z
    .object({
      tipRating: z.enum(["useful", "not_helpful"]),
      freeText: z.string().max(500).optional()
    })
    .parse(req.body ?? {});

  const row = await prisma.briefing.findUnique({ where: { id: briefingId }, select: { clientId: true } });
  if (!row) {
    res.status(404).json({ success: false, error: { message: "Briefing not found." } });
    return;
  }

  if (req.auth!.role === "CLIENT_USER") {
    if (req.auth!.clientId !== row.clientId) {
      res.status(403).json({ success: false, error: { message: "You do not have access to this." } });
      return;
    }
  } else {
    const ok = await agencyCanTouchClient(req.auth!.userId, row.clientId);
    if (!ok) {
      res.status(403).json({ success: false, error: { message: "You do not have access to this." } });
      return;
    }
  }

  const existing = await prisma.briefingFeedback.findFirst({
    where: { briefingId, userId: req.auth!.userId }
  });

  if (existing) {
    const updated = await prisma.briefingFeedback.update({
      where: { id: existing.id },
      data: { tipRating: body.tipRating, freeText: body.freeText ?? null }
    });
    res.json({ success: true, feedback: updated });
    return;
  }

  const created = await prisma.briefingFeedback.create({
    data: {
      briefingId,
      userId: req.auth!.userId,
      tipRating: body.tipRating,
      freeText: body.freeText ?? null
    }
  });
  res.status(201).json({ success: true, feedback: created });
});

briefingRouter.post("/record/:briefingId/share", async (req, res) => {
  const { briefingId } = z.object({ briefingId: z.string().min(1) }).parse(req.params);

  const row = await prisma.briefing.findUnique({ where: { id: briefingId }, select: { clientId: true } });
  if (!row) {
    res.status(404).json({ success: false, error: { message: "Briefing not found." } });
    return;
  }

  if (req.auth!.role === "CLIENT_USER") {
    if (req.auth!.clientId !== row.clientId) {
      res.status(403).json({ success: false, error: { message: "You do not have access to this." } });
      return;
    }
  } else {
    const ok = await agencyCanTouchClient(req.auth!.userId, row.clientId);
    if (!ok) {
      res.status(403).json({ success: false, error: { message: "You do not have access to this." } });
      return;
    }
  }

  const { token, expiresAt } = signBriefingShareToken(briefingId);
  res.json({
    success: true,
    token,
    expiresAt: expiresAt.toISOString(),
    sharePath: `/briefing/share/${encodeURIComponent(token)}`
  });
});

briefingRouter.post("/retry/:clientId", async (req, res) => {
  const { clientId } = z.object({ clientId: z.string().min(1) }).parse(req.params);
  if (req.auth!.role === "CLIENT_USER") {
    if (req.auth!.clientId !== clientId) {
      res.status(403).json({ success: false, error: { message: "You do not have access to this." } });
      return;
    }
  } else {
    const ok = await agencyCanTouchClient(req.auth!.userId, clientId);
    if (!ok) {
      res.status(403).json({ success: false, error: { message: "You do not have access to this." } });
      return;
    }
  }

  try {
    const text = await runBriefingNow(clientId);
    res.json({ success: true, briefing: text });
  } catch (_err) {
    res.status(500).json({
      success: false,
      error: { message: "Something went wrong. Please try again." }
    });
  }
});

briefingRouter.post("/trigger", async (req, res) => {
  const body = z.object({ clientId: z.string().optional() }).parse(req.body ?? {});
  const resolved = resolveClientId(req, body.clientId);
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

  try {
    const briefing = await runBriefingNow(resolved.clientId);
    res.json({ success: true, briefing });
  } catch (_err) {
    res.status(500).json({
      success: false,
      error: { message: "Something went wrong. Please try again." }
    });
  }
});

briefingRouter.patch("/settings", async (req, res) => {
  const body = z
    .object({
      clientId: z.string().optional(),
      whatsappNumber: z.string().nullable().optional(),
      briefingEnabled: z.boolean().optional(),
      briefingHourIst: z.number().int().min(0).max(23).optional()
    })
    .parse(req.body ?? {});

  const resolved = resolveClientId(req, body.clientId);
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

  const data: {
    whatsappNumber?: string | null;
    briefingEnabled?: boolean;
    briefingHourIst?: number;
  } = {};
  if (body.whatsappNumber !== undefined) {
    data.whatsappNumber = body.whatsappNumber;
  }
  if (body.briefingEnabled !== undefined) {
    data.briefingEnabled = body.briefingEnabled;
  }
  if (body.briefingHourIst !== undefined) {
    data.briefingHourIst = body.briefingHourIst;
  }
  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: "No updates provided." });
    return;
  }

  const updated = await prisma.client.update({
    where: { id: resolved.clientId },
    data,
    select: { id: true, whatsappNumber: true, briefingEnabled: true, briefingHourIst: true }
  });

  res.json({
    success: true,
    settings: {
      whatsappNumber: updated.whatsappNumber,
      briefingEnabled: updated.briefingEnabled,
      briefingHourIst: updated.briefingHourIst
    }
  });
});
