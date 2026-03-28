import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { detectLeadIntent } from "../services/leadDetection";
import { addIngestionJob } from "../queues/ingestionQueue";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { env } from "../config/env";

export const webhookRouter = Router();

webhookRouter.post("/ingestion", authenticate, requireRole("AGENCY_ADMIN"), async (req, res) => {
  if (env.INGESTION_MODE !== "mock") {
    res.status(400).json({ error: "Manual ingestion enqueue is only enabled when INGESTION_MODE=mock." });
    return;
  }

  const bodySchema = z.object({
    socialAccountId: z.string().min(1),
    platform: z.enum(["FACEBOOK", "INSTAGRAM", "TWITTER", "LINKEDIN", "TIKTOK"]).default("INSTAGRAM"),
    trigger: z.literal("manual").optional().default("manual")
  });

  const payload = bodySchema.parse(req.body);

  await addIngestionJob(
    "manual-mock-ingestion",
    {
      socialAccountId: payload.socialAccountId,
      platform: payload.platform,
      trigger: payload.trigger
    },
    {
      jobId: `mock-ingestion:${payload.socialAccountId}:${Date.now()}`,
      removeOnComplete: 100,
      attempts: 3,
      backoff: { type: "exponential", delay: 500 }
    }
  );

  res.status(202).json({ accepted: true });
});

webhookRouter.post("/social/:platform", async (req, res) => {
  const bodySchema = z.object({
    socialAccountId: z.string().min(1),
    eventType: z.enum(["comment", "message", "post"]),
    externalId: z.string().min(1),
    text: z.string().optional().default(""),
    authorId: z.string().optional().default("unknown"),
    authorName: z.string().optional().default("Unknown")
  });

  const payload = bodySchema.parse({
    ...req.body,
    platform: req.params.platform
  });

  const isLead = detectLeadIntent(payload.text);

  if (payload.eventType === "comment") {
    await prisma.comment.upsert({
      where: {
        socialAccountId_platformCommentId: {
          socialAccountId: payload.socialAccountId,
          platformCommentId: payload.externalId
        }
      },
      update: {
        text: payload.text,
        authorId: payload.authorId,
        authorName: payload.authorName,
        isLead
      },
      create: {
        socialAccountId: payload.socialAccountId,
        platformCommentId: payload.externalId,
        text: payload.text,
        authorId: payload.authorId,
        authorName: payload.authorName,
        isLead
      }
    });
  }

  if (payload.eventType === "message") {
    await prisma.message.upsert({
      where: {
        socialAccountId_platformMessageId: {
          socialAccountId: payload.socialAccountId,
          platformMessageId: payload.externalId
        }
      },
      update: {
        text: payload.text,
        fromId: payload.authorId,
        fromName: payload.authorName,
        isLead
      },
      create: {
        socialAccountId: payload.socialAccountId,
        platformMessageId: payload.externalId,
        text: payload.text,
        fromId: payload.authorId,
        fromName: payload.authorName,
        isLead
      }
    });
  }

  if (payload.eventType === "post") {
    await prisma.post.upsert({
      where: {
        socialAccountId_platformPostId: {
          socialAccountId: payload.socialAccountId,
          platformPostId: payload.externalId
        }
      },
      update: {
        content: payload.text || null,
        publishedAt: new Date()
      },
      create: {
        socialAccountId: payload.socialAccountId,
        platformPostId: payload.externalId,
        content: payload.text || null,
        publishedAt: new Date()
      }
    });
  }

  await addIngestionJob(
    "ingest-event",
    {
      socialAccountId: payload.socialAccountId,
      platform: req.params.platform,
      trigger: "webhook",
      eventType: payload.eventType,
      externalId: payload.externalId
    },
    {
      jobId: `ingest:${payload.socialAccountId}:${payload.eventType}:${payload.externalId}`,
      removeOnComplete: 100,
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 1000
      }
    }
  );

  res.status(202).json({ accepted: true, isLead });
});
