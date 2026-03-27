import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { tokenRefreshQueue } from "../queues/tokenRefreshQueue";

async function scheduleExpiringTokens() {
  const threshold = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const accounts = await prisma.socialAccount.findMany({
    where: {
      tokenExpiresAt: {
        lte: threshold
      }
    },
    select: {
      id: true
    }
  });

  await Promise.all(
    accounts.map((account: { id: string }) =>
      tokenRefreshQueue.add(
        "scheduled-token-refresh",
        { socialAccountId: account.id },
        { jobId: `token-refresh:${account.id}` }
      )
    )
  );

  logger.info("Scheduled token refresh jobs", { count: accounts.length });
}

scheduleExpiringTokens()
  .catch((error) => {
    logger.error("Token refresh scheduler failed", { message: error.message, stack: error.stack });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
