import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { resolveTenant } from "../middleware/resolveTenant";
import { getBillingStatus } from "../services/usageService";

export const billingRouter = Router();

billingRouter.use(authenticate);

billingRouter.get("/:clientId/status", resolveTenant, async (req, res) => {
  const { clientId } = z.object({ clientId: z.string().min(1) }).parse(req.params);
  const status = await getBillingStatus(clientId);
  res.json({ success: true, ...status });
});
