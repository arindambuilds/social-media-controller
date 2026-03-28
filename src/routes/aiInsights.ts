import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { resolveTenant } from "../middleware/resolveTenant";
import { tenantRateLimit } from "../middleware/tenantRateLimit";
import { generateInsight } from "../services/aiInsightService";

export const aiInsightsRouter = Router();

aiInsightsRouter.use(authenticate);
aiInsightsRouter.use(tenantRateLimit);

aiInsightsRouter.post("/content-performance/:clientId", resolveTenant, async (req, res) => {
  const params = z.object({ clientId: z.string().min(1) }).parse(req.params);
  const body = z
    .object({
      platform: z.string().min(1).default("INSTAGRAM")
    })
    .default({ platform: "INSTAGRAM" })
    .parse(req.body ?? {});

  const insight = await generateInsight(params.clientId, body.platform.toUpperCase());
  res.status(200).json({ success: true, ...insight });
});

