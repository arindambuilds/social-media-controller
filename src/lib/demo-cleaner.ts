import { prisma } from "./prisma";
import { logger } from "./logger";

export async function cleanDemoDataForUser(userId: string) {
  logger.info("Checking for demo data", { userId });
  const demoData = await prisma.demoData.findUnique({ where: { userId } });
  if (!demoData) {
    logger.info("No demo data found, nothing to clean", { userId });
    return;
  }

  logger.info("Starting transaction to clean demo data", { userId });
  await prisma.$transaction(async (tx) => {
    logger.info("Deleting conversations and messages", { userId });
    for (const convId of demoData.conversationIds) {
      await tx.dmMessage.deleteMany({ where: { conversationId: convId } });
      await tx.dmConversation.delete({ where: { id: convId } });
    }

    logger.info("Deleting reports", { userId });
    for (const reportId of demoData.reportIds) {
      await tx.report.delete({ where: { id: reportId } });
    }

    await tx.demoData.delete({ where: { userId } });

    await tx.user.update({
      where: { id: userId },
      data: { hasDemoData: false },
    });
  });

  logger.info("Demo data cleaning complete", { userId });
}
