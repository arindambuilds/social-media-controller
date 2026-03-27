import { Router } from "express";
import { z } from "zod";
import { signAccessToken } from "../auth/jwt";
import { issueOAuthState, consumeOAuthState } from "../services/oauthStateStore";

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
    platform: z.string().min(1)
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
