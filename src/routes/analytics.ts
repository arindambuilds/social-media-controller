import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { getInstagramAnalyticsSummary } from "../services/analyticsService";

export const analyticsRouter = Router();

analyticsRouter.use(authenticate);

analyticsRouter.get("/instagram/:clientId/summary", async (req, res) => {
  const params = z.object({
    clientId: z.string().min(1)
  }).parse(req.params);

  const summary = await getInstagramAnalyticsSummary(params.clientId);
  res.json(summary);
});
