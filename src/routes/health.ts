import { Router } from "express";
import { getDetailedHealth } from "../lib/healthCheck";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  const body = await getDetailedHealth();
  const code = body.database === "error" ? 503 : 200;
  res.status(code).json(body);
});
