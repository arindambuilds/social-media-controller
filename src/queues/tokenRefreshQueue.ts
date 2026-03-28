import type { JobsOptions } from "bullmq";
import { Queue } from "bullmq";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { decrypt, encrypt } from "../lib/encryption";
import { redisConnection } from "../lib/redis";
import { queueNames } from "./queueNames";
import { refreshInstagramLongLivedToken } from "../services/instagramOAuthService";
import { getLongLivedToken } from "../services/oauth/metaOAuth";
import { refreshAccessToken as refreshLinkedInAccessToken } from "../services/oauth/linkedinOAuth";

export type TokenRefreshJob = {
  socialAccountId: string;
  platform?: string;
};

export async function executeTokenRefreshJobSync(data: TokenRefreshJob): Promise<void> {
  const account = await prisma.socialAccount.findUnique({
    where: { id: data.socialAccountId }
  });

  if (!account) {
    logger.warn("Skipping token refresh for missing social account", data);
    return;
  }

  if (account.platform === "INSTAGRAM") {
    const currentToken = decrypt(account.encryptedToken);
    const refreshed = await refreshInstagramLongLivedToken(currentToken);

    await prisma.socialAccount.update({
      where: { id: account.id },
      data: {
        encryptedToken: encrypt(refreshed.accessToken),
        tokenExpiresAt: refreshed.expiresAt
      }
    });

    logger.info("Instagram token refresh completed (inline)", {
      socialAccountId: account.id,
      expiresAt: refreshed.expiresAt.toISOString()
    });
    return;
  }

  if (account.platform === "FACEBOOK") {
    try {
      const currentToken = decrypt(account.encryptedToken);
      const refreshed = await getLongLivedToken(currentToken);
      const expiresAt =
        refreshed.expiresIn != null ? new Date(Date.now() + refreshed.expiresIn * 1000) : undefined;
      await prisma.socialAccount.update({
        where: { id: account.id },
        data: {
          encryptedToken: encrypt(refreshed.accessToken),
          tokenExpiresAt: expiresAt ?? null
        }
      });
      logger.info("Facebook token refresh completed (inline)", { socialAccountId: account.id });
    } catch (err) {
      logger.warn("Facebook token refresh failed — skipping", {
        socialAccountId: account.id,
        message: err instanceof Error ? err.message : String(err)
      });
    }
    return;
  }

  if (account.platform === "LINKEDIN") {
    if (!account.encryptedRefreshToken) {
      logger.info("LinkedIn token refresh skipped — no refresh token stored", {
        socialAccountId: account.id
      });
      return;
    }
    try {
      const rt = decrypt(account.encryptedRefreshToken);
      const refreshed = await refreshLinkedInAccessToken(rt);
      const expiresAt =
        refreshed.expiresIn != null ? new Date(Date.now() + refreshed.expiresIn * 1000) : undefined;
      await prisma.socialAccount.update({
        where: { id: account.id },
        data: {
          encryptedToken: encrypt(refreshed.accessToken),
          encryptedRefreshToken: refreshed.refreshToken
            ? encrypt(refreshed.refreshToken)
            : account.encryptedRefreshToken,
          tokenExpiresAt: expiresAt ?? null
        }
      });
      logger.info("LinkedIn token refresh completed (inline)", { socialAccountId: account.id });
    } catch (err) {
      logger.warn("LinkedIn token refresh failed — skipping", {
        socialAccountId: account.id,
        message: err instanceof Error ? err.message : String(err)
      });
    }
    return;
  }

  if (account.platform === "TWITTER" || account.platform === "TIKTOK") {
    logger.info("Token refresh not implemented for platform — skipping", {
      socialAccountId: account.id,
      platform: account.platform
    });
    return;
  }

  logger.info("Token refresh placeholder (inline)", {
    socialAccountId: account.id,
    platform: account.platform
  });
}

export const tokenRefreshQueue: Queue<TokenRefreshJob> | null =
  redisConnection != null
    ? new Queue<TokenRefreshJob>(queueNames.tokenRefresh, { connection: redisConnection })
    : null;

export async function addTokenRefreshJob(
  name: string,
  data: TokenRefreshJob,
  opts?: JobsOptions
): Promise<void> {
  if (!tokenRefreshQueue) {
    console.warn(`[token-refresh] No Redis — running inline: ${name}`);
    await executeTokenRefreshJobSync(data);
    return;
  }
  await tokenRefreshQueue.add(name, data, opts);
}
