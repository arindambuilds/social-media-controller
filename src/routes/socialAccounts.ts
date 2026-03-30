import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { issueOAuthState } from "../services/oauthStateStore";
import { exchangeInstagramCode } from "../services/instagramOAuthService";
import {
  isSocialAccountOwnershipConflictError,
  upsertSocialAccount
} from "../services/socialAccountService";
import { buildAuthUrl as buildMetaAuthUrl } from "../services/oauth/metaOAuth";
import { buildAuthUrl as buildLinkedInAuthUrl } from "../services/oauth/linkedinOAuth";
import { addIngestionJob } from "../queues/ingestionQueue";
import { addTokenRefreshJob } from "../queues/tokenRefreshQueue";
import { writeAuditLog } from "../services/auditLogService";

export const socialAccountsRouter = Router();
const platformSchema = z.enum(["FACEBOOK", "INSTAGRAM", "TWITTER", "LINKEDIN", "TIKTOK"]);

socialAccountsRouter.use(authenticate);

function oauthCallbackBase(): string {
  return env.OAUTH_REDIRECT_BASE_URL.replace(/\/$/, "");
}

function canAccessClient(
  auth: { role: string; clientId?: string },
  clientId: string
): boolean {
  if (auth.role === "AGENCY_ADMIN") return true;
  return auth.clientId === clientId;
}

socialAccountsRouter.get("/", requireRole("AGENCY_ADMIN", "CLIENT_USER"), async (req, res) => {
  try {
    const clientId = z.string().min(1).parse(req.query.clientId);
    if (!req.auth || !canAccessClient(req.auth, clientId)) {
      res.status(403).json({ error: "Forbidden for this client." });
      return;
    }

    const rows = await prisma.socialAccount.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" }
    });

    const safe = (rows ?? []).map(
      ({ encryptedToken: _e, encryptedRefreshToken: _r, ...account }) => account
    );
    res.json({ success: true, accounts: safe });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message } });
  }
});

socialAccountsRouter.delete("/:id", requireRole("AGENCY_ADMIN", "CLIENT_USER"), async (req, res) => {
  const id = z.string().min(1).parse(req.params.id);
  const existing = await prisma.socialAccount.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  if (!req.auth || !canAccessClient(req.auth, existing.clientId)) {
    res.status(403).json({ error: "Forbidden for this client." });
    return;
  }

  await prisma.socialAccount.delete({ where: { id } });
  await writeAuditLog({
    clientId: existing.clientId,
    actorId: req.auth?.userId,
    action: "SOCIAL_ACCOUNT_REVOKED",
    entityType: "SocialAccount",
    entityId: existing.id,
    metadata: { platform: existing.platform, platformUserId: existing.platformUserId },
    ipAddress: req.ip
  });
  res.status(204).send();
});

const connectBody = z.object({ clientId: z.string().min(1) });

socialAccountsRouter.post("/connect/facebook", requireRole("AGENCY_ADMIN", "CLIENT_USER"), async (req, res) => {
  const { clientId } = connectBody.parse(req.body);
  if (!req.auth || !canAccessClient(req.auth, clientId)) {
    res.status(403).json({ error: "Forbidden for this client." });
    return;
  }
  const state = await issueOAuthState({
    clientId,
    platform: "FACEBOOK",
    initiatedBy: req.auth.userId
  });
  const redirectUri = `${oauthCallbackBase()}/api/oauth/facebook/callback`;
  const authUrl = buildMetaAuthUrl(state, redirectUri);
  await writeAuditLog({
    clientId,
    actorId: req.auth?.userId,
    action: "SOCIAL_ACCOUNT_CONNECT_STARTED",
    entityType: "OAuthState",
    entityId: state,
    metadata: { platform: "FACEBOOK", redirectUri },
    ipAddress: req.ip
  });
  res.json({ state, authUrl, redirectUri });
});

socialAccountsRouter.post("/connect/instagram", requireRole("AGENCY_ADMIN", "CLIENT_USER"), async (req, res) => {
  const { clientId } = connectBody.parse(req.body);
  if (!req.auth || !canAccessClient(req.auth, clientId)) {
    res.status(403).json({ error: "Forbidden for this client." });
    return;
  }
  const state = await issueOAuthState({
    clientId,
    platform: "INSTAGRAM",
    initiatedBy: req.auth.userId
  });
  const redirectUri = `${oauthCallbackBase()}/api/oauth/instagram/callback`;
  const authUrl = buildMetaAuthUrl(state, redirectUri);
  await writeAuditLog({
    clientId,
    actorId: req.auth?.userId,
    action: "SOCIAL_ACCOUNT_CONNECT_STARTED",
    entityType: "OAuthState",
    entityId: state,
    metadata: { platform: "INSTAGRAM", redirectUri },
    ipAddress: req.ip
  });
  res.json({ state, authUrl, redirectUri });
});

socialAccountsRouter.post("/connect/linkedin", requireRole("AGENCY_ADMIN", "CLIENT_USER"), async (req, res) => {
  const { clientId } = connectBody.parse(req.body);
  if (!req.auth || !canAccessClient(req.auth, clientId)) {
    res.status(403).json({ error: "Forbidden for this client." });
    return;
  }
  const state = await issueOAuthState({
    clientId,
    platform: "LINKEDIN",
    initiatedBy: req.auth.userId
  });
  const redirectUri = `${oauthCallbackBase()}/api/oauth/linkedin/callback`;
  const authUrl = buildLinkedInAuthUrl(state, redirectUri);
  await writeAuditLog({
    clientId,
    actorId: req.auth?.userId,
    action: "SOCIAL_ACCOUNT_CONNECT_STARTED",
    entityType: "OAuthState",
    entityId: state,
    metadata: { platform: "LINKEDIN", redirectUri },
    ipAddress: req.ip
  });
  res.json({ state, authUrl, redirectUri });
});

socialAccountsRouter.post("/instagram/start", requireRole("AGENCY_ADMIN", "CLIENT_USER"), async (req, res) => {
  const payload = z.object({
    clientId: z.string().min(1)
  }).parse(req.body);

  const auth = req.auth!;
  if (auth.role === "CLIENT_USER") {
    if (!auth.clientId || auth.clientId !== payload.clientId) {
      res.status(403).json({ error: "Forbidden for this client." });
      return;
    }
  }

  const state = await issueOAuthState({
    clientId: payload.clientId,
    platform: "INSTAGRAM",
    initiatedBy: req.auth?.userId ?? "unknown"
  });

  const clientId = env.INSTAGRAM_APP_ID || env.FACEBOOK_APP_ID || "";
  if (!clientId) {
    res.status(503).json({ error: "Instagram/Facebook OAuth is not configured (missing app id)." });
    return;
  }
  const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: env.INSTAGRAM_REDIRECT_URI,
    state,
    response_type: "code",
    scope: "instagram_basic,instagram_manage_insights,pages_show_list,business_management"
  }).toString()}`;

  await writeAuditLog({
    clientId: payload.clientId,
    actorId: req.auth?.userId,
    action: "SOCIAL_ACCOUNT_CONNECT_STARTED",
    entityType: "OAuthState",
    entityId: state,
    metadata: { platform: "INSTAGRAM", redirectUri: env.INSTAGRAM_REDIRECT_URI },
    ipAddress: req.ip
  });
  res.json({ state, authUrl });
});

socialAccountsRouter.post("/", requireRole("AGENCY_ADMIN"), async (req, res) => {
  try {
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

    await addTokenRefreshJob(
      "refresh-token",
      { socialAccountId: socialAccount.id },
      {
        jobId: `token-refresh:${socialAccount.id}`
      }
    );

    await writeAuditLog({
      clientId: payload.clientId,
      actorId: req.auth?.userId,
      action: "SOCIAL_ACCOUNT_LINKED",
      entityType: "SocialAccount",
      entityId: socialAccount.id,
      metadata: { platform: payload.platform, platformUserId: payload.platformUserId },
      ipAddress: req.ip
    });

    res.status(201).json(socialAccount);
  } catch (err) {
    if (isSocialAccountOwnershipConflictError(err)) {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }
});

socialAccountsRouter.post("/instagram/exchange", requireRole("AGENCY_ADMIN"), async (req, res) => {
  try {
    const payload = z.object({
      clientId: z.string().min(1),
      code: z.string().min(1)
    }).parse(req.body);

    const result = await exchangeInstagramCode(payload.code);
    const socialAccount = await upsertSocialAccount({
      clientId: payload.clientId,
      platform: "INSTAGRAM",
      platformUserId: result.instagramBusinessAccountId,
      platformUsername: result.instagramUsername,
      pageId: result.pageId,
      pageName: result.pageName,
      accessToken: result.accessToken,
      tokenExpiresAt: result.expiresAt ?? undefined
    });

    await addIngestionJob(
      "instagram-manual-connect",
      {
        socialAccountId: socialAccount.id,
        platform: "INSTAGRAM",
        trigger: "manual"
      },
      {
        jobId: `instagram-sync:${socialAccount.id}:manual`
      }
    );

    await writeAuditLog({
      clientId: payload.clientId,
      actorId: req.auth?.userId,
      action: "SOCIAL_ACCOUNT_LINKED",
      entityType: "SocialAccount",
      entityId: socialAccount.id,
      metadata: {
        platform: "INSTAGRAM",
        platformUserId: result.instagramBusinessAccountId,
        pageId: result.pageId
      },
      ipAddress: req.ip
    });

    res.status(201).json(socialAccount);
  } catch (err) {
    if (isSocialAccountOwnershipConflictError(err)) {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }
});
