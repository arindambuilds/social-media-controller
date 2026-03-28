import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { resolveTenant, resolveTenantFromBody } from "../middleware/resolveTenant";
import { tenantRateLimit } from "../middleware/tenantRateLimit";
import { generateInsight } from "../services/aiInsightService";
import {
  generateCaptions,
  generateWeeklyRecommendations
} from "../services/aiService";

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
