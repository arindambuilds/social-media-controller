import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { issueOAuthState, consumeOAuthState } from "../services/oauthStateStore";
import { exchangeInstagramCode } from "../services/instagramOAuthService";
import { upsertSocialAccount } from "../services/socialAccountService";
import { addIngestionJob } from "../queues/ingestionQueue";
import { login, refresh, registerUserByAgency, signup } from "../services/authService";
import { requireRole } from "../middleware/requireRole";
import { buildInstagramBrowserOAuthUrl } from "../lib/instagramBrowserOAuth";
import { isDatabaseConnectivityError } from "../lib/databaseErrors";
import { logger } from "../lib/logger";
import { loginAuthLimiter, refreshAuthLimiter, registerAuthLimiter } from "../middleware/rateLimiter";
import {
  isSocialAccountOwnershipConflictError
} from "../services/socialAccountService";
import { writeAuditLog } from "../services/auditLogService";
import { clearAuthCookieHeaders, REFRESH_COOKIE, setAuthCookieHeaders } from "../lib/authCookies";

export const authRouter = Router();

function attachAuthCookiesIfEnabled(res: Response, accessToken: string, refreshToken: string): void {
  if (env.AUTH_HTTPONLY_COOKIES) {
    setAuthCookieHeaders(res, accessToken, refreshToken);
  }
}

const SERVICE_UNAVAILABLE_BODY = {
  success: false,
  error: {
    code: "SERVICE_UNAVAILABLE",
    message: "Service temporarily unavailable. Please try again shortly."
  }
} as const;

function toAuthUserResponse(user: {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  clientId?: string | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    role: user.role,
    clientId: user.clientId ?? null
  };
}

function respondValidationErrors(res: Response, err: z.ZodError): void {
  res.status(400).json({
    success: false,
    error: {
      code: "VALIDATION_ERROR",
      fieldErrors: err.flatten().fieldErrors
    }
  });
}

function respondDbUnavailable(res: Response, err: unknown, context: string): boolean {
  if (!isDatabaseConnectivityError(err)) return false;
  logger.error(`Database unavailable: ${context}`, {
    message: err instanceof Error ? err.message : String(err)
  });
  res.status(503).json(SERVICE_UNAVAILABLE_BODY);
  return true;
}

authRouter.get("/me", authenticate, async (req, res) => {
  try {
    if (!req.auth?.userId) {
      res.status(401).json({ success: false, error: { code: "NO_SESSION", message: "Not authenticated." } });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      select: { id: true, email: true, name: true, role: true, clientId: true, plan: true }
    });
    if (!user) {
      res.status(401).json({ success: false, error: { code: "USER_NOT_FOUND", message: "User not found." } });
      return;
    }

    let instagramConnected = false;
    if (user.clientId) {
      const acc = await prisma.socialAccount.findFirst({
        where: { clientId: user.clientId, platform: "INSTAGRAM" }
      });
      instagramConnected = !!acc;
    }

    res.json({ success: true, user, instagramConnected, plan: user.plan ?? "free" });
  } catch (err) {
    if (respondDbUnavailable(res, err, "GET /api/auth/me")) return;
    logger.error("GET /api/auth/me failed", {
      message: err instanceof Error ? err.message : String(err)
    });
    res.status(500).json({ success: false, error: { code: "ME_ERROR", message: "Failed to load user." } });
  }
});

authRouter.patch("/me", authenticate, async (req, res) => {
  const body = z
    .object({
      email: z.string().email().optional(),
      name: z.string().max(120).nullable().optional()
    })
    .parse(req.body ?? {});

  if (Object.keys(body).length === 0) {
    res.status(400).json({ success: false, error: { message: "No updates provided." } });
    return;
  }

  if (body.email) {
    const clash = await prisma.user.findFirst({
      where: { email: body.email, NOT: { id: req.auth!.userId } }
    });
    if (clash) {
      res.status(409).json({
        success: false,
        error: { message: "That email is already in use." }
      });
      return;
    }
  }

  const updated = await prisma.user.update({
    where: { id: req.auth!.userId },
    data: {
      ...(body.email !== undefined ? { email: body.email } : {}),
      ...(body.name !== undefined ? { name: body.name } : {})
    },
    select: { id: true, email: true, name: true, role: true, clientId: true }
  });

  let instagramConnected = false;
  if (updated.clientId) {
    const acc = await prisma.socialAccount.findFirst({
      where: { clientId: updated.clientId, platform: "INSTAGRAM" }
    });
    instagramConnected = !!acc;
  }

  res.json({ success: true, user: updated, instagramConnected });
});

authRouter.get("/oauth/instagram/authorise", authenticate, async (req, res) => {
  const auth = req.auth!;
  const built = await buildInstagramBrowserOAuthUrl({
    role: auth.role,
    userId: auth.userId,
    clientIdFromToken: auth.clientId,
    query: req.query as Record<string, unknown>
  });
  if (!built.ok) {
    res.status(built.status).json({ error: built.message });
    return;
  }
  res.json({ url: built.url });
});

/** Browser redirect variant (same OAuth URL as authorise). */
authRouter.get("/instagram", authenticate, async (req, res) => {
  const auth = req.auth!;
  const built = await buildInstagramBrowserOAuthUrl({
    role: auth.role,
    userId: auth.userId,
    clientIdFromToken: auth.clientId,
    query: req.query as Record<string, unknown>
  });
  if (!built.ok) {
    res.status(built.status).send(built.message);
    return;
  }
  res.redirect(302, built.url);
});

/** Agency-only: create another user (staff / client login). */
authRouter.post("/register", registerAuthLimiter, authenticate, requireRole("AGENCY_ADMIN"), async (req, res) => {
  try {
    const payload = z
      .object({
        email: z.string().email(),
        password: z.string().min(8),
        role: z.enum(["AGENCY_ADMIN", "CLIENT_USER"]),
        clientId: z.string().optional(),
        name: z.string().min(2).optional()
      })
      .parse(req.body);

    const result = await registerUserByAgency(payload);
    await writeAuditLog({
      clientId: result.user.clientId ?? payload.clientId ?? null,
      actorId: req.auth?.userId,
      action: "USER_REGISTERED_BY_AGENCY",
      entityType: "User",
      entityId: result.user.id,
      metadata: { email: result.user.email, role: result.user.role },
      ipAddress: req.ip
    });
    attachAuthCookiesIfEnabled(res, result.accessToken, result.refreshToken);
    res.status(201).json({
      success: true,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: toAuthUserResponse(result.user)
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      respondValidationErrors(res, err);
      return;
    }
    if (respondDbUnavailable(res, err, "POST /api/auth/register")) return;
    const message = err instanceof Error ? err.message : "Registration failed.";
    const status = message.includes("already exists") ? 409 : 400;
    res.status(status).json({
      success: false,
      error: { code: status === 409 ? "CONFLICT" : "BAD_REQUEST", message }
    });
  }
});

authRouter.post("/signup", registerAuthLimiter, async (req, res) => {
  try {
    const payload = z.object({
      email: z.string().email(),
      password: z.string().min(8),
      name: z.string().min(2),
      clientId: z.string().optional()
    }).parse(req.body);

    const result = await signup(payload);
    await writeAuditLog({
      clientId: result.user.clientId ?? null,
      actorId: result.user.id,
      action: "USER_SIGNED_UP",
      entityType: "User",
      entityId: result.user.id,
      metadata: { email: result.user.email, role: result.user.role },
      ipAddress: req.ip
    });
    attachAuthCookiesIfEnabled(res, result.accessToken, result.refreshToken);
    res.status(201).json({
      success: true,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: toAuthUserResponse(result.user)
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      respondValidationErrors(res, err);
      return;
    }
    if (respondDbUnavailable(res, err, "POST /api/auth/signup")) return;
    const message = err instanceof Error ? err.message : "Signup failed.";
    const status = message.includes("already exists") ? 409 : 400;
    res.status(status).json({
      success: false,
      error: { code: status === 409 ? "CONFLICT" : "BAD_REQUEST", message }
    });
  }
});

authRouter.post("/login", loginAuthLimiter, async (req, res) => {
  try {
    const payload = z.object({
      email: z.string().email(),
      password: z.string().min(8)
    }).parse(req.body);

    // Prisma/DB connectivity → respondDbUnavailable (503). Bad credentials → 401 below. No silent catch.
    const result = await login(payload);
    attachAuthCookiesIfEnabled(res, result.accessToken, result.refreshToken);
    res.json({
      success: true,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: toAuthUserResponse(result.user)
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      respondValidationErrors(res, err);
      return;
    }
    if (respondDbUnavailable(res, err, "POST /api/auth/login")) return;
    const message = err instanceof Error ? err.message : "Login failed.";
    res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message }
    });
  }
});

authRouter.post("/logout", (_req, res) => {
  clearAuthCookieHeaders(res);
  res.status(204).send();
});

authRouter.post("/refresh", refreshAuthLimiter, async (req, res) => {
  try {
    let refreshToken: string | undefined;
    if (env.AUTH_HTTPONLY_COOKIES) {
      const loose = z.object({ refreshToken: z.string().min(1).optional() }).safeParse(req.body);
      const bodyRt = loose.success ? loose.data.refreshToken?.trim() : undefined;
      const cookieRt =
        typeof req.cookies?.[REFRESH_COOKIE] === "string" ? req.cookies[REFRESH_COOKIE] : undefined;
      refreshToken = bodyRt || cookieRt;
    } else {
      const parsed = z.object({ refreshToken: z.string().min(1) }).parse(req.body);
      refreshToken = parsed.refreshToken;
    }

    if (!refreshToken) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          fieldErrors: { refreshToken: ["Required"] }
        }
      });
      return;
    }

    const result = await refresh(refreshToken);
    attachAuthCookiesIfEnabled(res, result.accessToken, result.refreshToken);
    res.json({
      success: true,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: toAuthUserResponse(result.user)
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      respondValidationErrors(res, err);
      return;
    }
    if (respondDbUnavailable(res, err, "POST /api/auth/refresh")) return;
    const message = err instanceof Error ? err.message : "Refresh failed.";
    res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message }
    });
  }
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

async function handleBrowserInstagramOAuthCallback(req: Request, res: Response) {
  const query = z.object({
    code: z.string().min(1),
    state: z.string().min(1)
  }).parse(req.query);

  const context = await consumeOAuthState(query.state);
  if (!context?.clientId) {
    res.status(400).json({ error: "Invalid or expired OAuth state." });
    return;
  }

  const result = await exchangeInstagramCode(query.code, env.INSTAGRAM_FRONTEND_REDIRECT_URI);
  let socialAccount;
  try {
    socialAccount = await upsertSocialAccount({
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
  } catch (err) {
    if (isSocialAccountOwnershipConflictError(err)) {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }

  await addIngestionJob(
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

  await writeAuditLog({
    clientId: context.clientId,
    actorId: context.initiatedBy ?? null,
    action: "SOCIAL_ACCOUNT_LINKED",
    entityType: "SocialAccount",
    entityId: socialAccount.id,
    metadata: {
      platform: "INSTAGRAM",
      platformUserId: socialAccount.platformUserId,
      pageId: socialAccount.pageId
    },
    ipAddress: req.ip
  });

  res.status(201).json({
    connected: true,
    socialAccountId: socialAccount.id,
    platformUserId: socialAccount.platformUserId
  });
}

authRouter.get("/oauth/instagram/callback", handleBrowserInstagramOAuthCallback);
/** Alias for Meta “Valid OAuth Redirect URIs” (same handler as `/oauth/instagram/callback`). */
authRouter.get("/instagram/callback", handleBrowserInstagramOAuthCallback);
