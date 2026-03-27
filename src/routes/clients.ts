import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";

export const clientsRouter = Router();

clientsRouter.use(authenticate);

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
