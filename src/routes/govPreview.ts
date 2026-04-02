import { Router } from "express";
import { redisConnection } from "../lib/redis";
import { GOV_METRICS_REDIS_KEY, runRefreshGovMetrics } from "../jobs/refreshGovMetrics";

export const pulseGovPreviewRouter = Router();

pulseGovPreviewRouter.get("/gov-preview", async (_req, res) => {
  try {
    if (!redisConnection) {
      const live = await runRefreshGovMetrics();
      res.status(200).json({
        msmes: live.msmes,
        leadsThisWeek: live.leadsThisWeek,
        odiaPercent: live.odiaPercent,
        updatedAt: live.updatedAt
      });
      return;
    }
    const raw = await redisConnection.get(GOV_METRICS_REDIS_KEY);
    if (!raw) {
      res.status(200).json({
        msmes: 0,
        leadsThisWeek: 0,
        odiaPercent: 0,
        updatedAt: null as string | null
      });
      return;
    }
    const parsed = JSON.parse(raw) as {
      msmes?: number;
      leadsThisWeek?: number;
      odiaPercent?: number;
      updatedAt?: string;
    };
    res.status(200).json({
      msmes: typeof parsed.msmes === "number" ? parsed.msmes : 0,
      leadsThisWeek: typeof parsed.leadsThisWeek === "number" ? parsed.leadsThisWeek : 0,
      odiaPercent: typeof parsed.odiaPercent === "number" ? parsed.odiaPercent : 0,
      updatedAt: parsed.updatedAt ?? null
    });
  } catch {
    res.status(200).json({
      msmes: 0,
      leadsThisWeek: 0,
      odiaPercent: 0,
      updatedAt: null as string | null
    });
  }
});
