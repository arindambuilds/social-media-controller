import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import {
  generateCaptions,
  generateContentPerformanceInsight,
  generateWeeklyRecommendations
} from "../services/aiService";

export const aiRouter = Router();

aiRouter.use(authenticate);

aiRouter.post("/insights/content-performance/:clientId", async (req, res) => {
  const params = z.object({
    clientId: z.string().min(1)
  }).parse(req.params);

  const insight = await generateContentPerformanceInsight(params.clientId);
  res.status(201).json(insight);
});

aiRouter.post("/captions/generate", async (req, res) => {
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

aiRouter.post("/recommendations/weekly/:clientId", async (req, res) => {
  const params = z.object({
    clientId: z.string().min(1)
  }).parse(req.params);

  const recommendation = await generateWeeklyRecommendations(params.clientId);
  res.status(201).json(recommendation);
});
