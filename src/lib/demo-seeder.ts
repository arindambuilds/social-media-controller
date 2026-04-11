import { prisma } from "./prisma";
import { logger } from "./logger";

export async function seedDemoDataForUser(userId: string) {
  logger.info("Checking if demo data already exists", { userId });
  const existing = await prisma.demoData.findUnique({ where: { userId } });
  if (existing) {
    logger.info("Demo data already exists, skipping", { userId });
    return;
  }

  logger.info("Fetching user and client", { userId });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { client: true },
  });
  if (!user) {
    throw new Error("User not found");
  }

  let clientId: string;
  if (user.client) {
    clientId = user.client.id;
  } else {
    // Recovery path: user exists but has no linked client (e.g. fresh deploy).
    // Upsert the demo-client record and link it to the user before seeding.
    logger.warn("User has no linked client — upserting demo-client and linking", { userId });
    const client = await prisma.client.upsert({
      where: { id: "demo-client" },
      update: { ownerId: userId },
      create: {
        id: "demo-client",
        name: "Aroma Silk House",
        ownerId: userId,
      },
    });
    await prisma.user.update({
      where: { id: userId },
      data: { clientId: client.id },
    });
    clientId = client.id;
    logger.info("demo-client upserted and linked to user", { userId, clientId });
  }

  logger.info("Starting transaction to seed demo data", { userId });
  await prisma.$transaction(async (tx) => {
    const conversationIds: string[] = [];
    const personas = [
      { name: "Priya Sharma", topic: "pricing" },
      { name: "Rajan Patel", topic: "order" },
      { name: "Sunita Devi", topic: "hours" },
      { name: "Amit Kumar", topic: "complaint" },
      { name: "Meena Agarwal", topic: "inquiry" },
    ];

    for (const persona of personas) {
      logger.debug("Creating conversation for persona", { name: persona.name });
      const conv = await tx.dmConversation.create({
        data: {
          clientId,
          instagramUserId: `demo_${persona.name.replace(/\s+/g, "_").toLowerCase()}`,
          senderName: persona.name,
          status: ["active", "resolved", "pending"][Math.floor(Math.random() * 3)] as any,
        },
      });
      conversationIds.push(conv.id);

      const numMessages = 3 + Math.floor(Math.random() * 4);
      logger.debug("Creating messages for conversation", { convId: conv.id, count: numMessages });
      for (let i = 0; i < numMessages; i++) {
        const isCustomer = i % 2 === 0;
        const direction = isCustomer ? "inbound" : "outbound";
        const content = getDemoMessage(persona.topic, i, isCustomer);
        const sentByAi = !isCustomer && Math.random() < 0.5;
        const daysAgo = Math.floor(Math.random() * 7);
        const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

        await tx.dmMessage.create({
          data: {
            conversationId: conv.id,
            direction,
            content,
            sentByAi,
            createdAt,
          },
        });
      }
    }

    logger.info("Creating demo reports", { userId });
    const reportIds: string[] = [];
    const reportsData = [
      {
        month: getLastMonth(),
        totalMessages: 47,
        replyRate: 78,
        avgResponseTime: 4.2,
        resolved: 38,
        autoReplied: 22,
      },
      {
        month: getMonthBefore(),
        totalMessages: 63,
        replyRate: 85,
        avgResponseTime: 6.1,
        resolved: 51,
        autoReplied: 31,
      },
    ];

    for (const data of reportsData) {
      const report = await tx.report.create({
        data: {
          clientId,
          userId,
          reportType: "monthly",
          pdfStatus: "completed",
          pdfUrl: `demo-report-${data.month}.pdf`,
        },
      });
      reportIds.push(report.id);
    }

    logger.info("Creating DemoData record", { userId });
    await tx.demoData.create({
      data: {
        userId,
        conversationIds,
        reportIds,
      },
    });

    logger.info("Updating user flags", { userId });
    await tx.user.update({
      where: { id: userId },
      data: {
        hasDemoData: true,
        onboardingStep: 1,
      },
    });
  });

  logger.info("Demo data seeding complete", { userId });
}

function getDemoMessage(topic: string, index: number, isCustomer: boolean): string {
  const messages = {
    pricing: {
      customer: [
        "Hello, can you tell me about your pricing?",
        "Kitna charge karte ho monthly?",
        "Is there a free trial available?",
      ],
      business: [
        "Sure, our plans start from ₹500/month.",
        "We have different tiers based on your needs.",
        "Yes, 7-day free trial is available.",
      ],
    },
    order: {
      customer: [
        "I placed an order last week, any update?",
        "Mera order kab deliver hoga?",
        "Can you check the status of my order?",
      ],
      business: [
        "Your order is being processed, will ship soon.",
        "Delivery expected in 2-3 days.",
        "Order status updated, tracking sent.",
      ],
    },
    hours: {
      customer: [
        "What are your business hours?",
        "Kab tak open rehte ho?",
        "Do you work on weekends?",
      ],
      business: [
        "We are open 9 AM to 6 PM, Monday to Saturday.",
        "Sunday closed, but emergency support available.",
        "Business hours: Mon-Sat 9-6, Sun closed.",
      ],
    },
    complaint: {
      customer: [
        "Your response is very slow, not happy.",
        "Bahut late reply dete ho, improve karo.",
        "I waited 2 days for a response!",
      ],
      business: [
        "Sorry for the delay, we'll improve our response time.",
        "We apologize, working on faster replies.",
        "Thank you for feedback, we'll address this.",
      ],
    },
    inquiry: {
      customer: [
        "I want to know more about your services.",
        "Kya services provide karte ho?",
        "Can you explain what you do?",
      ],
      business: [
        "We provide WhatsApp automation for businesses.",
        "Our services include chatbots, analytics, etc.",
        "We help automate customer interactions.",
      ],
    },
  };

  const topicMessages = messages[topic as keyof typeof messages];
  const side = isCustomer ? "customer" : "business";
  const msgList = topicMessages[side as keyof typeof topicMessages];
  return msgList[index % msgList.length];
}

function getLastMonth(): string {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return lastMonth.toISOString().slice(0, 7);
}

function getMonthBefore(): string {
  const now = new Date();
  const monthBefore = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  return monthBefore.toISOString().slice(0, 7);
}