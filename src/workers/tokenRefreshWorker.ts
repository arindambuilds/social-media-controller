import { Job, Worker } from "bullmq";
import { prisma } from "../lib/prisma";
import { redisConnection } from "../lib/redis";
import { logger } from "../lib/logger";
import { queueNames } from "../queues/queueNames";
import type { TokenRefreshJob } from "../queues/tokenRefreshQueue";
import { decrypt, encrypt } from "../lib/encryption";
import { refreshInstagramLongLivedToken } from "../services/instagramOAuthService";
import { getLongLivedToken } from "../services/oauth/metaOAuth";
import { refreshAccessToken as refreshLinkedInAccessToken } from "../services/oauth/linkedinOAuth";

if (!redisConnection) {
  logger.error("Token refresh worker requires REDIS_URL");
  process.exit(1);
}
const redis = redisConnection;

async function processTokenRefresh(job: Job<TokenRefreshJob>) {
  const account = await prisma.socialAccount.findUnique({
    where: { id: job.data.socialAccountId }
  });

  if (!account) {
    logger.warn("Skipping token refresh for missing social account", job.data);
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

    logger.info("Instagram token refresh completed", {
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
      logger.info("Facebook token exchange refresh completed", { socialAccountId: account.id });
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
      logger.info("LinkedIn token refresh completed", { socialAccountId: account.id });
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

  logger.info("Token refresh placeholder executed", {
    socialAccountId: account.id,
    platform: account.platform
  });
}

new Worker<TokenRefreshJob>(queueNames.tokenRefresh, processTokenRefresh, {
  connection: redis,
  concurrency: 3
});

logger.info("Token refresh worker started");
