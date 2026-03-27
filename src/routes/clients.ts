import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { resolveTenant } from "../middleware/resolveTenant";
import { requireRole } from "../middleware/requireRole";

export const clientsRouter = Router();

clientsRouter.use(authenticate);

clientsRouter.get("/:clientId/sync-status", resolveTenant, async (req, res) => {
  const { clientId } = z.object({ clientId: z.string().min(1) }).parse(req.params);

  const ig = await prisma.socialAccount.findFirst({
    where: { clientId, platform: "INSTAGRAM" }
  });

  if (!ig) {
    res.json({
      status: "idle" as const,
      postsSynced: 0,
      instagramConnected: false,
      lastSyncedAt: null as string | null
    });
    return;
  }

  const postsSynced = await prisma.post.count({ where: { socialAccountId: ig.id } });
  const ageMs = Date.now() - ig.createdAt.getTime();
  const syncing = postsSynced === 0 && ageMs < 3 * 60 * 1000;

  res.json({
    status: syncing ? ("syncing" as const) : ("completed" as const),
    postsSynced,
    instagramConnected: true,
    lastSyncedAt: ig.lastSyncedAt?.toISOString() ?? null
  });
});

clientsRouter.get("/", requireRole("AGENCY_ADMIN"), async (_req, res) => {
  const clients = await prisma.client.findMany({
    include: {
      socialAccounts: true,
      leads: true
    }
  });

  res.json(clients);
});

clientsRouter.post("/", requireRole("AGENCY_ADMIN"), async (req, res) => {
  const bodySchema = z.object({
    name: z.string().min(2),
    ownerId: z.string().min(1),
    agencyId: z.string().optional()
  });

  const payload = bodySchema.parse(req.body);

  const client = await prisma.client.create({
    data: {
      name: payload.name,
      ownerId: payload.ownerId,
      agencyId: payload.agencyId
    }
  });

  res.status(201).json(client);
});
