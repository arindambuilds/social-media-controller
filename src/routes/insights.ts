import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { resolveTenant } from "../middleware/resolveTenant";
import { tenantRateLimit } from "../middleware/tenantRateLimit";
import {
  cooldownRemainingSeconds,
  generateInsight,
  getLatestContentInsightPayload,
  applyInsightFeedback
} from "../services/aiInsightService";

export const insightsRouter = Router();

insightsRouter.use(authenticate);
insightsRouter.use(tenantRateLimit);

insightsRouter.get("/:clientId/content-performance/latest", resolveTenant, async (req, res) => {
  const { clientId } = z.object({ clientId: z.string().min(1) }).parse(req.params);
  const payload = await getLatestContentInsightPayload(clientId);
  res.json({ success: true, ...payload });
});

insightsRouter.post("/:clientId/content-performance/generate", resolveTenant, async (req, res) => {
  const { clientId } = z.object({ clientId: z.string().min(1) }).parse(req.params);

  const latest = await prisma.aiInsight.findFirst({
    where: { clientId, platform: "INSTAGRAM" },
    orderBy: { generatedAt: "desc" }
  });

  if (latest && cooldownRemainingSeconds(latest.generatedAt) > 0) {
    res.status(429).json({
      error: "Content insight cooldown active.",
      cooldownRemainingSeconds: cooldownRemainingSeconds(latest.generatedAt)
    });
    return;
  }

  try {
    await generateInsight(clientId, "INSTAGRAM");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Insight generation failed.";
    res.status(502).json({
      error: "AI insight unavailable.",
      detail: message
    });
    return;
  }

  const payload = await getLatestContentInsightPayload(clientId);
  res.status(201).json({ success: true, ...payload });
});

insightsRouter.post("/:clientId/:insightId/feedback", resolveTenant, async (req, res) => {
  const params = z
    .object({ clientId: z.string().min(1), insightId: z.string().min(1) })
    .parse(req.params);
  const body = z.object({ vote: z.enum(["up", "down"]) }).parse(req.body);

  const ok = await applyInsightFeedback(params.insightId, params.clientId, body.vote);
  if (!ok) {
    res.status(404).json({ error: "Insight not found." });
    return;
  }

  res.json({ success: true });
});
