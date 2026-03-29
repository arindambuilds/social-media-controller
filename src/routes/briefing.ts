import type { Request } from "express";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { tenantRateLimit } from "../middleware/tenantRateLimit";
import { runBriefingNow } from "../jobs/morningBriefing";

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
    select: { id: true, content: true, sentAt: true, createdAt: true }
  });

  res.json({ briefing: briefing ?? null });
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Briefing failed";
    res.status(500).json({ error: message });
  }
});

briefingRouter.patch("/settings", async (req, res) => {
  const body = z
    .object({
      clientId: z.string().optional(),
      whatsappNumber: z.string().nullable().optional(),
      briefingEnabled: z.boolean().optional()
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

  const data: { whatsappNumber?: string | null; briefingEnabled?: boolean } = {};
  if (body.whatsappNumber !== undefined) {
    data.whatsappNumber = body.whatsappNumber;
  }
  if (body.briefingEnabled !== undefined) {
    data.briefingEnabled = body.briefingEnabled;
  }
  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: "No updates provided." });
    return;
  }

  const updated = await prisma.client.update({
    where: { id: resolved.clientId },
    data,
    select: { id: true, whatsappNumber: true, briefingEnabled: true }
  });

  res.json({
    success: true,
    settings: {
      whatsappNumber: updated.whatsappNumber,
      briefingEnabled: updated.briefingEnabled
    }
  });
});
