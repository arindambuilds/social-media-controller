import { Router } from "express";
import { z } from "zod";
import { signAccessToken } from "../auth/jwt";
import { issueOAuthState, consumeOAuthState } from "../services/oauthStateStore";
import { exchangeInstagramCode } from "../services/instagramOAuthService";
import { upsertSocialAccount } from "../services/socialAccountService";
import { ingestionQueue } from "../queues/ingestionQueue";

export const authRouter = Router();

authRouter.post("/login", (req, res) => {
  const bodySchema = z.object({
    userId: z.string().min(1),
    role: z.enum(["AGENCY_ADMIN", "CLIENT_USER"]),
    clientId: z.string().optional()
  });

  const payload = bodySchema.parse(req.body);
  const token = signAccessToken({
    sub: payload.userId,
    role: payload.role,
    clientId: payload.clientId
  });

  res.json({ token });
});

authRouter.post("/oauth/state", async (req, res) => {
  const bodySchema = z.object({
    clientId: z.string().min(1),
    platform: z.string().min(1),
    initiatedBy: z.string().optional()
  });

  const payload = bodySchema.parse(req.body);
  const state = await issueOAuthState(payload);
  res.json({ state });
});

authRouter.post("/oauth/validate", async (req, res) => {
  const bodySchema = z.object({
    state: z.string().min(1)
  });

  const payload = bodySchema.parse(req.body);
  const stateContext = await consumeOAuthState(payload.state);

  if (!stateContext) {
    res.status(400).json({ error: "Invalid or expired OAuth state." });
    return;
  }

  res.json({ valid: true, context: stateContext });
});

authRouter.get("/oauth/instagram/callback", async (req, res) => {
  const query = z.object({
    code: z.string().min(1),
    state: z.string().min(1)
  }).parse(req.query);

  const context = await consumeOAuthState(query.state);
  if (!context?.clientId) {
    res.status(400).json({ error: "Invalid or expired OAuth state." });
    return;
  }

  const result = await exchangeInstagramCode(query.code);
  const socialAccount = await upsertSocialAccount({
    clientId: context.clientId,
    platform: "INSTAGRAM",
    platformUserId: result.instagramBusinessAccountId,
    platformUsername: result.instagramUsername,
    pageId: result.pageId,
    pageName: result.pageName,
    accessToken: result.accessToken,
    refreshToken: undefined,
    tokenExpiresAt: result.expiresAt ?? undefined
  });

  await ingestionQueue.add(
    "instagram-oauth-connect",
    {
      socialAccountId: socialAccount.id,
      platform: "INSTAGRAM",
      trigger: "oauth_connect"
    },
    {
      jobId: `instagram-sync:${socialAccount.id}:oauth-connect`
    }
  );

  res.status(201).json({
    connected: true,
    socialAccountId: socialAccount.id,
    platformUserId: socialAccount.platformUserId
  });
});
