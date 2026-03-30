import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { getPublicHealthSnapshot } from "../lib/healthCheck";

export const adminSystemRouter = Router();

adminSystemRouter.use(authenticate);
adminSystemRouter.use(requireRole("AGENCY_ADMIN"));

adminSystemRouter.get("/system", async (_req, res) => {
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      whatsappNumber: true,
      briefingEnabled: true,
      briefingHourIst: true,
      ingestionPausedUntil: true,
      owner: { select: { email: true } },
      briefings: {
        orderBy: { sentAt: "desc" },
        take: 1,
        select: {
          sentAt: true,
          whatsappDelivered: true,
          emailDelivered: true
        }
      }
    }
  });

  const failures = await prisma.systemEvent.findMany({
    where: {
      level: "error",
      createdAt: { gte: new Date(Date.now() - 24 * 3600_000) }
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      category: true,
      message: true,
      createdAt: true
    }
  });

  const health = await getPublicHealthSnapshot();

  res.json({
    success: true,
    clients: clients.map((c) => {
      const b = c.briefings[0];
      return {
        id: c.id,
        name: c.name,
        ownerEmail: c.owner.email,
        whatsappNumber: c.whatsappNumber,
        briefingEnabled: c.briefingEnabled,
        briefingHourIst: c.briefingHourIst,
        ingestionPausedUntil: c.ingestionPausedUntil?.toISOString() ?? null,
        lastBriefingAt: b?.sentAt.toISOString() ?? null,
        lastWhatsappDelivered: b?.whatsappDelivered ?? null,
        lastEmailDelivered: b?.emailDelivered ?? null
      };
    }),
    failures24h: failures.map((f) => ({
      id: f.id,
      category: f.category,
      message: f.message,
      at: f.createdAt.toISOString()
    })),
    health
  });
});
