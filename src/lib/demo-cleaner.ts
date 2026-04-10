import { prisma } from "./prisma";

export async function cleanDemoDataForUser(userId: string) {
  console.log(`Checking for demo data for user ${userId}`);
  const demoData = await prisma.demoData.findUnique({ where: { userId } });
  if (!demoData) {
    console.log("No demo data found, nothing to clean");
    return;
  }

  console.log("Starting transaction to clean demo data");
  await prisma.$transaction(async (tx) => {
    console.log("Deleting conversations and messages");
    for (const convId of demoData.conversationIds) {
      await tx.dmMessage.deleteMany({ where: { conversationId: convId } });
      await tx.dmConversation.delete({ where: { id: convId } });
    }

    console.log("Deleting reports");
    for (const reportId of demoData.reportIds) {
      await tx.report.delete({ where: { id: reportId } });
    }

    console.log("Deleting DemoData record");
    await tx.demoData.delete({ where: { userId } });

    console.log("Updating user flags");
    await tx.user.update({
      where: { id: userId },
      data: {
        hasDemoData: false,
      },
    });
  });

  console.log("Demo data cleaning complete");
}