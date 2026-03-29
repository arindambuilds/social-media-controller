import type { Request } from "express";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { OutboundPostStatus, Platform } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { tenantRateLimit } from "../middleware/tenantRateLimit";
import { addPostPublishJob } from "../queues/postPublishQueue";
import { writeAuditLog } from "../services/auditLogService";
import { generateCaption } from "../services/captionGenerator";
import { parseVoiceIntent, type VoicePlatform } from "../services/intentParser";
import { transcribeAudio } from "../services/transcribe";

export const voicePostRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

voicePostRouter.use(authenticate);
voicePostRouter.use(tenantRateLimit);

function canAccessClient(auth: Request["auth"], clientId: string): boolean {
  if (!auth) return false;
  if (auth.role === "AGENCY_ADMIN") return true;
  return auth.clientId === clientId;
}

function resolveClientId(
  req: Request,
  bodyOrQueryClientId?: string
): { ok: true; clientId: string } | { ok: false; status: number; error: string } {
  const role = req.auth!.role;
  if (role === "CLIENT_USER") {
    if (!req.auth!.clientId) {
      return { ok: false, status: 400, error: "No client assigned to this account." };
    }
    return { ok: true, clientId: req.auth!.clientId };
  }
  const q = req.query.clientId;
  const qStr =
    typeof q === "string" && q.trim()
      ? q.trim()
      : Array.isArray(q) && typeof q[0] === "string" && q[0].trim()
        ? q[0].trim()
        : undefined;
  const cid = bodyOrQueryClientId?.trim() || qStr;
  if (!cid) {
    return { ok: false, status: 400, error: "clientId is required for agency users." };
  }
  return { ok: true, clientId: cid };
}

async function pickSocialAccountId(clientId: string, platform: VoicePlatform): Promise<string | null> {
  const accounts = await prisma.socialAccount.findMany({
    where: { clientId },
    select: { id: true, platform: true },
    orderBy: { createdAt: "asc" }
  });
  if (!accounts.length) return null;

  const wantIg = platform === "instagram" || platform === "both";
  const wantFb = platform === "facebook" || platform === "both";

  if (wantIg) {
    const ig = accounts.find((a) => a.platform === Platform.INSTAGRAM);
    if (ig) return ig.id;
  }
  if (wantFb) {
    const fb = accounts.find((a) => a.platform === Platform.FACEBOOK);
    if (fb) return fb.id;
  }
  return accounts[0]!.id;
}

voicePostRouter.post("/transcribe", upload.single("audio"), async (req, res) => {
  const file = req.file;
  if (!file?.buffer?.length) {
    res.status(400).json({ error: "Missing audio file (field name: audio)." });
    return;
  }

  const bodyClientId =
    typeof req.body?.clientId === "string" && req.body.clientId.trim() ? req.body.clientId.trim() : undefined;
  const resolved = resolveClientId(req, bodyClientId);
  if (!resolved.ok) {
    res.status(resolved.status).json({ error: resolved.error });
    return;
  }
  if (!canAccessClient(req.auth, resolved.clientId)) {
    res.status(403).json({ error: "Forbidden for this client." });
    return;
  }

  try {
    const transcript = await transcribeAudio(file.buffer, file.mimetype || "audio/webm");
    res.json({ transcript });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transcription failed";
    res.status(503).json({ error: message });
  }
});

const generateBody = z.object({
  transcript: z.string().min(1),
  clientId: z.string().optional()
});

voicePostRouter.post("/generate", async (req, res) => {
  const body = generateBody.parse(req.body ?? {});
  const resolved = resolveClientId(req, body.clientId);
  if (!resolved.ok) {
    res.status(resolved.status).json({ error: resolved.error });
    return;
  }
  if (!canAccessClient(req.auth, resolved.clientId)) {
    res.status(403).json({ error: "Forbidden for this client." });
    return;
  }

  const client = await prisma.client.findUnique({
    where: { id: resolved.clientId },
    select: { name: true }
  });
  const businessName = client?.name ?? "Your business";

  const intent = await parseVoiceIntent(body.transcript);
  const result = await generateCaption(intent, businessName);

  res.json({
    intent,
    caption: result.caption,
    hashtags: result.hashtags,
    imagePrompt: result.imagePrompt,
    suggestedTime: result.suggestedTime.toISOString()
  });
});

const saveBody = z.object({
  clientId: z.string().optional(),
  caption: z.string().min(1),
  hashtags: z.array(z.string()).default([]),
  scheduledTime: z.string().datetime(),
  platform: z.enum(["instagram", "facebook", "both"]).default("instagram")
});

voicePostRouter.post("/save", async (req, res) => {
  const body = saveBody.parse(req.body ?? {});
  const resolved = resolveClientId(req, body.clientId);
  if (!resolved.ok) {
    res.status(resolved.status).json({ error: resolved.error });
    return;
  }
  if (!canAccessClient(req.auth, resolved.clientId)) {
    res.status(403).json({ error: "Forbidden for this client." });
    return;
  }

  const socialAccountId = await pickSocialAccountId(resolved.clientId, body.platform);
  if (!socialAccountId) {
    res.status(400).json({ error: "No social account connected for this client. Link Instagram or Facebook first." });
    return;
  }

  const scheduledAt = new Date(body.scheduledTime);
  if (Number.isNaN(scheduledAt.getTime())) {
    res.status(400).json({ error: "Invalid scheduledTime." });
    return;
  }

  const tagList = body.hashtags.map((h) => h.replace(/^#/, "").trim()).filter(Boolean);

  const row = await prisma.scheduledPost.create({
    data: {
      clientId: resolved.clientId,
      socialAccountId,
      caption: body.caption,
      mediaUrls: [],
      hashtags: tagList,
      status: OutboundPostStatus.SCHEDULED,
      scheduledAt
    },
    include: { socialAccount: { select: { platform: true, platformUsername: true } } }
  });

  const delay = Math.max(0, scheduledAt.getTime() - Date.now());
  await addPostPublishJob("publish", { scheduledPostId: row.id }, { delay, jobId: `scheduled-post:${row.id}` });

  await writeAuditLog({
    clientId: resolved.clientId,
    actorId: req.auth?.userId,
    action: "VOICE_POST_SCHEDULED",
    entityType: "ScheduledPost",
    entityId: row.id,
    metadata: {
      socialAccountId,
      scheduledAt: scheduledAt.toISOString(),
      source: "voice"
    },
    ipAddress: req.ip
  });

  res.status(201).json({ success: true, post: row });
});
