import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { globalApiLimiter } from "../middleware/rateLimiter";
import { logger } from "../lib/logger";

export const campaignsRouter = Router();

campaignsRouter.use(authenticate, globalApiLimiter);

const createBody = z.object({
  clientId: z.string().min(1),
  name: z.string().min(1).max(120),
  budget: z.number().positive().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
});

const updateBody = z.object({
  name: z.string().min(1).max(120).optional(),
  budget: z.number().positive().optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
});

/** GET /api/campaigns?clientId=xxx */
campaignsRouter.get("/", async (req, res) => {
  try {
    const clientId = z.string().min(1).parse(req.query.clientId);
    const campaigns = await prisma.campaign.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, campaigns });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "clientId is required" });
      return;
    }
    logger.error("GET /api/campaigns failed", { message: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: "Failed to fetch campaigns" });
  }
});

/** POST /api/campaigns */
campaignsRouter.post("/", async (req, res) => {
  try {
    const body = createBody.parse(req.body);
    const campaign = await prisma.campaign.create({
      data: {
        clientId: body.clientId,
        name: body.name,
        budget: body.budget ?? null,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
      },
    });
    res.status(201).json({ success: true, campaign });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.flatten().fieldErrors });
      return;
    }
    logger.error("POST /api/campaigns failed", { message: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: "Failed to create campaign" });
  }
});

/** PATCH /api/campaigns/:id */
campaignsRouter.patch("/:id", async (req, res) => {
  try {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const body = updateBody.parse(req.body);
    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.budget !== undefined && { budget: body.budget }),
        ...(body.startsAt !== undefined && { startsAt: body.startsAt ? new Date(body.startsAt) : null }),
        ...(body.endsAt !== undefined && { endsAt: body.endsAt ? new Date(body.endsAt) : null }),
      },
    });
    res.json({ success: true, campaign });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.flatten().fieldErrors });
      return;
    }
    logger.error("PATCH /api/campaigns failed", { message: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: "Failed to update campaign" });
  }
});

/** DELETE /api/campaigns/:id */
campaignsRouter.delete("/:id", async (req, res) => {
  try {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    await prisma.campaign.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    logger.error("DELETE /api/campaigns failed", { message: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: "Failed to delete campaign" });
  }
});
