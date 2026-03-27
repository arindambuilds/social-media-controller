import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { detectLeadIntent } from "../services/leadDetection";
import { ingestionQueue } from "../queues/ingestionQueue";

export const webhookRouter = Router();

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

  await ingestionQueue.add(
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
