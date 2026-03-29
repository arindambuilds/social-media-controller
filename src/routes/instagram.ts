import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { addIngestionJob } from "../queues/ingestionQueue";
import { writeAuditLog } from "../services/auditLogService";

export const instagramRouter = Router();

instagramRouter.use(authenticate);

/** Queue an Instagram ingestion job for the client (mock or real Graph per INGESTION_MODE). */
instagramRouter.post("/sync", async (req, res) => {
  const body = z.object({ clientId: z.string().min(1) }).parse(req.body);
  const auth = req.auth!;

  if (auth.role === "CLIENT_USER") {
    if (!auth.clientId || auth.clientId !== body.clientId) {
      res.status(403).json({ error: "Forbidden for this client." });
      return;
    }
  }

  const ig = await prisma.socialAccount.findFirst({
    where: { clientId: body.clientId, platform: "INSTAGRAM" },
    select: { id: true }
  });

  if (!ig) {
    res.status(404).json({ error: "No Instagram account linked for this client." });
    return;
  }

  await addIngestionJob(
    "instagram-manual-api",
    {
      socialAccountId: ig.id,
      platform: "INSTAGRAM",
      trigger: "manual"
    },
    { jobId: `instagram-sync:${ig.id}:${Date.now()}` }
  );

  await writeAuditLog({
    clientId: body.clientId,
    actorId: req.auth?.userId,
    action: "INSTAGRAM_SYNC_REQUESTED",
    entityType: "SocialAccount",
    entityId: ig.id,
    metadata: { trigger: "manual" },
    ipAddress: req.ip
  });

  res.status(202).json({ success: true, socialAccountId: ig.id, message: "Sync job queued." });
});
