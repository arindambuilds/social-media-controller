import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { upsertSocialAccount } from "../services/socialAccountService";
import { tokenRefreshQueue } from "../queues/tokenRefreshQueue";

export const socialAccountsRouter = Router();
const platformSchema = z.enum(["FACEBOOK", "INSTAGRAM", "TWITTER", "LINKEDIN", "TIKTOK"]);

socialAccountsRouter.use(authenticate);

socialAccountsRouter.post("/", requireRole("AGENCY_ADMIN"), async (req, res) => {
  const bodySchema = z.object({
    clientId: z.string().min(1),
    platform: platformSchema,
    platformUserId: z.string().min(1),
    accessToken: z.string().min(1),
    refreshToken: z.string().optional(),
    tokenExpiresAt: z.string().datetime().optional()
  });

  const payload = bodySchema.parse(req.body);
  const socialAccount = await upsertSocialAccount({
    clientId: payload.clientId,
    platform: payload.platform,
    platformUserId: payload.platformUserId,
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    tokenExpiresAt: payload.tokenExpiresAt ? new Date(payload.tokenExpiresAt) : undefined
  });

  await tokenRefreshQueue.add(
    "refresh-token",
    { socialAccountId: socialAccount.id },
    {
      jobId: `token-refresh:${socialAccount.id}`
    }
  );

  res.status(201).json(socialAccount);
});
