import { Router } from "express";
import { getDetailedHealth, withHealthProbeTimeout } from "../lib/healthCheck";
import { logger } from "../lib/logger";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  try {
    const body = await withHealthProbeTimeout(getDetailedHealth());
    // Never take the whole app "down" due to dependency blips.
    res.status(200).json(body);
  } catch (err) {
    logger.warn("/api/health/db probe failed", {
      message: err instanceof Error ? err.message : String(err)
    });
    res.status(503).json({ status: "error", message: "Health probe timed out or failed." });
  }
});
