import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env";
import { redisConnection } from "../lib/redis";
import { logger } from "../lib/logger";
import { consumeOAuthState } from "../services/oauthStateStore";
import {
  exchangeCode as exchangeMetaCode,
  getLongLivedToken,
  listPagesWithTokens
} from "../services/oauth/metaOAuth";
import { pickPageForInstagram } from "../services/oauth/instagramOAuth";
import { exchangeCode as exchangeLinkedInCode, getProfile } from "../services/oauth/linkedinOAuth";
import { upsertSocialAccount } from "../services/socialAccountService";
import { addIngestionJob } from "../queues/ingestionQueue";

export const oauthCallbacksRouter = Router();

function oauthBase(): string {
  return env.OAUTH_REDIRECT_BASE_URL.replace(/\/$/, "");
}

function getOAuthStateError(state: string): Error {
  if (!redisConnection) {
    logger.warn("Redis unavailable during OAuth state validation", { state });
    return new Error("Authentication service temporarily unavailable. Please try again.");
  }
  return new Error("Invalid or expired OAuth state.");
}

async function runFacebookOAuth(code: string, state: string): Promise<string> {
  const ctx = await consumeOAuthState(state);
  if (!ctx?.clientId) {
    throw getOAuthStateError(state);
  }

  const redirectUri = `${oauthBase()}/api/oauth/facebook/callback`;
  const short = await exchangeMetaCode(code, redirectUri);
  const long = await getLongLivedToken(short.accessToken);
  const pages = await listPagesWithTokens(long.accessToken);
  const page = pages[0];
  if (!page) {
    throw new Error("No Facebook Pages found for this account.");
  }

  const expiresAt =
    long.expiresIn != null ? new Date(Date.now() + long.expiresIn * 1000) : undefined;

  const social = await upsertSocialAccount({
    clientId: ctx.clientId,
    platform: "FACEBOOK",
    platformUserId: page.id,
    platformUsername: page.name,
    pageId: page.id,
    pageName: page.name,
    accessToken: page.access_token,
    tokenExpiresAt: expiresAt
  });

  return social.id;
}

async function runInstagramOAuth(code: string, state: string): Promise<string> {
  const ctx = await consumeOAuthState(state);
  if (!ctx?.clientId) {
    throw getOAuthStateError(state);
  }

  const redirectUri = `${oauthBase()}/api/oauth/instagram/callback`;
  const short = await exchangeMetaCode(code, redirectUri);
  const long = await getLongLivedToken(short.accessToken);
  const pages = await listPagesWithTokens(long.accessToken);
  const page = pickPageForInstagram(pages);
  if (!page?.instagram_business_account?.id) {
    throw new Error("No Instagram business account found on the connected Meta account.");
  }

  const ig = page.instagram_business_account;
  const expiresAt =
    long.expiresIn != null ? new Date(Date.now() + long.expiresIn * 1000) : undefined;

  const social = await upsertSocialAccount({
    clientId: ctx.clientId,
    platform: "INSTAGRAM",
    platformUserId: ig.id,
    platformUsername: ig.username ?? page.name,
    pageId: page.id,
    pageName: page.name,
    accessToken: long.accessToken,
    tokenExpiresAt: expiresAt
  });

  await addIngestionJob(
    "instagram-oauth-connect",
    {
      socialAccountId: social.id,
      platform: "INSTAGRAM",
      trigger: "oauth_connect"
    },
    { jobId: `instagram-sync:${social.id}:oauth-connect` }
  );

  return social.id;
}

async function runLinkedInOAuth(code: string, state: string): Promise<string> {
  const ctx = await consumeOAuthState(state);
  if (!ctx?.clientId) {
    throw getOAuthStateError(state);
  }

  const redirectUri = `${oauthBase()}/api/oauth/linkedin/callback`;
  const tokens = await exchangeLinkedInCode(code, redirectUri);
  const profile = await getProfile(tokens.accessToken);
  const expiresAt =
    tokens.expiresIn != null ? new Date(Date.now() + tokens.expiresIn * 1000) : undefined;

  const social = await upsertSocialAccount({
    clientId: ctx.clientId,
    platform: "LINKEDIN",
    platformUserId: profile.id,
    platformUsername: profile.localizedFirstName ?? profile.id,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tokenExpiresAt: expiresAt
  });

  return social.id;
}

function parseCodeState(
  body: unknown,
  query: Record<string, unknown>
): { code: string; state: string } {
  const fromBody = z.object({ code: z.string().min(1), state: z.string().min(1) }).safeParse(body);
  if (fromBody.success) return fromBody.data;
  return z.object({ code: z.string().min(1), state: z.string().min(1) }).parse({
    code: query.code,
    state: query.state
  });
}

function dashboardOrigin(): string {
  try {
    return new URL(env.INSTAGRAM_FRONTEND_REDIRECT_URI).origin;
  } catch {
    return "http://localhost:3000";
  }
}

function isAuthServiceUnavailableError(err: unknown): boolean {
  return err instanceof Error &&
    err.message === "Authentication service temporarily unavailable. Please try again.";
}

oauthCallbacksRouter.post("/facebook/callback", async (req, res) => {
  try {
    const { code, state } = parseCodeState(req.body, req.query as Record<string, unknown>);
    const socialAccountId = await runFacebookOAuth(code, state);
    res.json({ success: true, socialAccountId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "OAuth failed.";
    const status = isAuthServiceUnavailableError(err) ? 503 : 400;
    res.status(status).json({ error: message });
  }
});

oauthCallbacksRouter.get("/facebook/callback", async (req, res) => {
  try {
    const { code, state } = parseCodeState({}, req.query as Record<string, unknown>);
    await runFacebookOAuth(code, state);
    res.redirect(302, `${dashboardOrigin()}/accounts?connected=facebook`);
  } catch (err) {
    const message = encodeURIComponent(err instanceof Error ? err.message : "OAuth failed.");
    res.redirect(302, `${dashboardOrigin()}/accounts?oauth_error=${message}`);
  }
});

oauthCallbacksRouter.post("/instagram/callback", async (req, res) => {
  try {
    const { code, state } = parseCodeState(req.body, req.query as Record<string, unknown>);
    const socialAccountId = await runInstagramOAuth(code, state);
    res.json({ success: true, socialAccountId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "OAuth failed.";
    const status = isAuthServiceUnavailableError(err) ? 503 : 400;
    res.status(status).json({ error: message });
  }
});

oauthCallbacksRouter.get("/instagram/callback", async (req, res) => {
  try {
    const { code, state } = parseCodeState({}, req.query as Record<string, unknown>);
    await runInstagramOAuth(code, state);
    res.redirect(302, `${dashboardOrigin()}/accounts?connected=instagram`);
  } catch (err) {
    const message = encodeURIComponent(err instanceof Error ? err.message : "OAuth failed.");
    res.redirect(302, `${dashboardOrigin()}/accounts?oauth_error=${message}`);
  }
});

oauthCallbacksRouter.post("/linkedin/callback", async (req, res) => {
  try {
    const { code, state } = parseCodeState(req.body, req.query as Record<string, unknown>);
    const socialAccountId = await runLinkedInOAuth(code, state);
    res.json({ success: true, socialAccountId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "OAuth failed.";
    const status = isAuthServiceUnavailableError(err) ? 503 : 400;
    res.status(status).json({ error: message });
  }
});

oauthCallbacksRouter.get("/linkedin/callback", async (req, res) => {
  try {
    const { code, state } = parseCodeState({}, req.query as Record<string, unknown>);
    await runLinkedInOAuth(code, state);
    res.redirect(302, `${dashboardOrigin()}/accounts?connected=linkedin`);
  } catch (err) {
    const message = encodeURIComponent(err instanceof Error ? err.message : "OAuth failed.");
    res.redirect(302, `${dashboardOrigin()}/accounts?oauth_error=${message}`);
  }
});
