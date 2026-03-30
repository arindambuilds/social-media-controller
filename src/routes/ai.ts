import { createHash } from "crypto";
import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { resolveTenant, resolveTenantFromBody } from "../middleware/resolveTenant";
import { dmPreviewLimiter } from "../middleware/rateLimiter";
import { tenantRateLimit } from "../middleware/tenantRateLimit";
import { redisConnection } from "../lib/redis";
import { prisma } from "../lib/prisma";
import { generateInsight } from "../services/aiInsightService";
import {
  generateCaptions,
  generateWeeklyRecommendations
} from "../services/aiService";
import { generateDmReplyPreview } from "../services/dmReplyPreviewService";
import { logAiUsage } from "../services/aiUsageLogService";

export const aiRouter = Router();

aiRouter.use(authenticate);
aiRouter.use(tenantRateLimit);

aiRouter.get("/", (_req, res) => {
  res.json({
    ok: true,
    endpoints: [
      "/api/ai/insights/content-performance/:clientId",
      "/api/ai/captions/generate",
      "/api/ai/:clientId/captions/generate",
      "/api/ai/recommendations/weekly/:clientId"
    ]
  });
});

aiRouter.post("/insights/content-performance/:clientId", resolveTenant, async (req, res) => {
  const params = z.object({
    clientId: z.string().min(1)
  }).parse(req.params);
  const body = z.object({ platform: z.string().default("INSTAGRAM") }).parse(req.body ?? {});

  const insight = await generateInsight(params.clientId, body.platform.toUpperCase());
  res.status(200).json({ success: true, ...insight });
});

aiRouter.post("/captions/generate", resolveTenantFromBody(), async (req, res) => {
  const payload = z.object({
    clientId: z.string().min(1),
    niche: z.string().min(1),
    tone: z.string().min(1),
    objective: z.string().min(1),
    offer: z.string().optional()
  }).parse(req.body);

  const result = await generateCaptions(payload);
  res.json(result);
});

aiRouter.post("/recommendations/weekly/:clientId", resolveTenant, async (req, res) => {
  const params = z.object({
    clientId: z.string().min(1)
  }).parse(req.params);

  const recommendation = await generateWeeklyRecommendations(params.clientId);
  res.status(201).json(recommendation);
});

aiRouter.post(
  "/dm-reply-preview",
  dmPreviewLimiter,
  resolveTenantFromBody(),
  async (req, res) => {
    const body = z
      .object({
        clientId: z.string().min(1),
        businessContext: z.string().max(2000),
        tone: z.string().max(120),
        sampleUserMessage: z.string().max(2000)
      })
      .parse(req.body ?? {});

    const cachePayload = {
      clientId: body.clientId,
      businessContext: body.businessContext,
      tone: body.tone,
      sampleUserMessage: body.sampleUserMessage
    };
    const hash = createHash("sha256").update(JSON.stringify(cachePayload)).digest("hex");
    const cacheKey = `dm-prev:${hash}`;

    if (redisConnection) {
      const hit = await redisConnection.get(cacheKey);
      if (hit) {
        try {
          const parsed = JSON.parse(hit) as Record<string, unknown>;
          res.json({ ...parsed, cached: true });
          return;
        } catch {
          /* fall through */
        }
      }
    }

    const client = await prisma.client.findUnique({
      where: { id: body.clientId },
      select: { name: true }
    });
    if (!client) {
      res.status(404).json({ success: false, error: { message: "Client not found." } });
      return;
    }

    const result = await generateDmReplyPreview({
      businessName: client.name,
      businessContext: body.businessContext,
      tone: body.tone,
      sampleUserMessage: body.sampleUserMessage
    });

    await logAiUsage({
      clientId: body.clientId,
      feature: "dm_reply_preview",
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      metadata: { latencyMs: result.latencyMs }
    });

    const out = {
      success: true,
      reply: result.reply,
      tokensUsed: result.tokensIn + result.tokensOut,
      latencyMs: result.latencyMs,
      cached: false
    };

    if (redisConnection) {
      await redisConnection.set(cacheKey, JSON.stringify(out), "EX", 600);
    }

    res.json(out);
  }
);

aiRouter.post("/:clientId/captions/generate", resolveTenant, async (req, res) => {
  const params = z.object({ clientId: z.string().min(1) }).parse(req.params);
  const body = z
    .object({
      tone: z.string().min(1),
      goal: z.string().min(1),
      offer: z.string().optional(),
      niche: z.string().optional()
    })
    .parse(req.body);

  const result = await generateCaptions({
    clientId: params.clientId,
    niche: body.niche ?? "local business",
    tone: body.tone,
    objective: body.goal,
    offer: body.offer
  });
  res.json(result);
});
