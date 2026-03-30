import { Router } from "express";
import { prisma } from "../lib/prisma";
import { verifyBriefingShareToken } from "../lib/briefingShareToken";

export const briefingPublicRouter = Router();

/** Public read-only briefing via signed share token (24h). */
briefingPublicRouter.get("/share/:token", async (req, res) => {
  const token = req.params.token?.trim() ?? "";
  const payload = verifyBriefingShareToken(token);
  if (!payload) {
    res.status(410).json({ success: false, error: { message: "This link has expired or is invalid." } });
    return;
  }

  const row = await prisma.briefing.findUnique({
    where: { id: payload.briefingId },
    include: { client: { select: { name: true } } }
  });

  if (!row) {
    res.status(404).json({ success: false, error: { message: "Briefing not found." } });
    return;
  }

  res.json({
    success: true,
    briefing: {
      id: row.id,
      content: row.content,
      tipText: row.tipText,
      metricsJson: row.metricsJson,
      sentAt: row.sentAt.toISOString(),
      businessName: row.client.name,
      whatsappDelivered: row.whatsappDelivered,
      emailDelivered: row.emailDelivered
    }
  });
});
