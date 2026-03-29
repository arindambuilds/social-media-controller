import type { Request } from "express";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { tenantRateLimit } from "../middleware/tenantRateLimit";
import { addPostPublishJob } from "../queues/postPublishQueue";
import { writeAuditLog } from "../services/auditLogService";

export const postsRouter = Router();

postsRouter.use(authenticate);
postsRouter.use(tenantRateLimit);

function canAccessClient(auth: Request["auth"], clientId: string): boolean {
  if (!auth) return false;
  if (auth.role === "AGENCY_ADMIN") return true;
  return auth.clientId === clientId;
}

postsRouter.get("/", async (req, res) => {
  const clientId = z.string().min(1).parse(req.query.clientId);
  if (!canAccessClient(req.auth, clientId)) {
    res.status(403).json({ error: "Forbidden for this client." });
    return;
  }

  const rows = await prisma.scheduledPost.findMany({
    where: { clientId },
    orderBy: { updatedAt: "desc" },
    include: { socialAccount: { select: { platform: true, platformUsername: true } } }
  });

  res.json({ success: true, posts: rows });
});

const createBody = z.object({
  clientId: z.string().min(1),
  socialAccountId: z.string().min(1),
  caption: z.string().default(""),
  mediaUrls: z.array(z.string()).default([]),
  hashtags: z.array(z.string()).default([]),
  scheduledAt: z.string().datetime().optional(),
  status: z.enum(["DRAFT", "SCHEDULED"]).default("DRAFT")
});

postsRouter.post("/", async (req, res) => {
  const body = createBody.parse(req.body);
  if (!canAccessClient(req.auth, body.clientId)) {
    res.status(403).json({ error: "Forbidden for this client." });
    return;
  }

  const acc = await prisma.socialAccount.findFirst({
    where: { id: body.socialAccountId, clientId: body.clientId }
  });
  if (!acc) {
    res.status(400).json({ error: "Social account not found for this client." });
    return;
  }

  const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
  const row = await prisma.scheduledPost.create({
    data: {
      clientId: body.clientId,
      socialAccountId: body.socialAccountId,
      caption: body.caption,
      mediaUrls: body.mediaUrls,
      hashtags: body.hashtags,
      status: body.status,
      scheduledAt
    }
  });

  if (body.status === "SCHEDULED") {
    const delay = scheduledAt ? Math.max(0, scheduledAt.getTime() - Date.now()) : 0;
    await addPostPublishJob(
      "publish",
      { scheduledPostId: row.id },
      { delay, jobId: `scheduled-post:${row.id}` }
    );
  }

  await writeAuditLog({
    clientId: body.clientId,
    actorId: req.auth?.userId,
    action: body.status === "SCHEDULED" ? "SCHEDULED_POST_CREATED" : "DRAFT_POST_CREATED",
    entityType: "ScheduledPost",
    entityId: row.id,
    metadata: {
      socialAccountId: body.socialAccountId,
      status: body.status,
      scheduledAt: row.scheduledAt?.toISOString() ?? null
    },
    ipAddress: req.ip
  });

  res.status(201).json({ success: true, post: row });
});

postsRouter.delete("/:id", async (req, res) => {
  const id = z.string().min(1).parse(req.params.id);
  const existing = await prisma.scheduledPost.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  if (!canAccessClient(req.auth, existing.clientId)) {
    res.status(403).json({ error: "Forbidden for this client." });
    return;
  }
  if (existing.status !== "DRAFT" && existing.status !== "SCHEDULED") {
    res.status(400).json({ error: "Only DRAFT or SCHEDULED posts can be deleted." });
    return;
  }

  await prisma.scheduledPost.delete({ where: { id } });
  await writeAuditLog({
    clientId: existing.clientId,
    actorId: req.auth?.userId,
    action: "SCHEDULED_POST_DELETED",
    entityType: "ScheduledPost",
    entityId: existing.id,
    metadata: { status: existing.status },
    ipAddress: req.ip
  });
  res.status(204).send();
});
