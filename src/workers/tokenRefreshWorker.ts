import { Job, Worker } from "bullmq";
import { prisma } from "../lib/prisma";
import { redisConnection } from "../lib/redis";
import { logger } from "../lib/logger";
import { queueNames } from "../queues/queueNames";
import type { TokenRefreshJob } from "../queues/tokenRefreshQueue";
import { decrypt, encrypt } from "../lib/encryption";
import { refreshInstagramLongLivedToken } from "../services/instagramOAuthService";

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

  logger.info("Token refresh placeholder executed", {
    socialAccountId: account.id,
    platform: account.platform
  });
}

new Worker<TokenRefreshJob>(queueNames.tokenRefresh, processTokenRefresh, {
  connection: redisConnection,
  concurrency: 3
});

logger.info("Token refresh worker started");
