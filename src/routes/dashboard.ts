import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { logger } from "../lib/logger";

export const dashboardRouter = Router();

dashboardRouter.get("/stats", authenticate, async (req, res) => {
  try {
    if (!req.auth?.userId) {
      res.status(401).json({ success: false, error: { code: "NO_SESSION", message: "Not authenticated." } });
      return;
    }

    const userId = req.auth.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { client: true },
    });
    if (!user || !user.client) {
      return res.status(400).json({ error: "User or client not found" });
    }
    const clientId = user.client.id;

    const isDemoData = user.hasDemoData;
    let totalConversations = 0;
    let messagesThisMonth = 0;
    let replyRate = 0;
    let avgResponseTime = 0;
    let recentConversations: any[] = [];
    let automationEnabled = false;

    if (isDemoData) {
      // Pull from demo data
      const demoData = await prisma.demoData.findUnique({
        where: { userId },
      });
      if (demoData) {
        // Conversations
        const conversations = await prisma.dmConversation.findMany({
          where: { id: { in: demoData.conversationIds } },
          include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
        });
        totalConversations = conversations.length;
        // For messagesThisMonth, count messages in current month
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const messages = await prisma.dmMessage.findMany({
          where: {
            conversationId: { in: demoData.conversationIds },
            createdAt: { gte: startOfMonth },
          },
        });
        messagesThisMonth = messages.length;
        // Reply rate: outbound / inbound
        const inbound = messages.filter(m => m.direction === "inbound").length;
        const outbound = messages.filter(m => m.direction === "outbound").length;
        replyRate = inbound > 0 ? Math.round((outbound / inbound) * 100) : 0;
        // Avg response time: hardcode 4.2 for demo
        avgResponseTime = 4.2;
        // Recent conversations
        recentConversations = conversations.slice(0, 5).map(conv => ({
          id: conv.id,
          customerName: conv.senderName || conv.instagramUserId,
          lastMessage: conv.messages[0]?.content || "",
          lastMessageTime: conv.messages[0]?.createdAt || conv.createdAt,
          status: conv.status,
          isAutoReplied: conv.messages.some(m => m.sentByAi),
        }));
        // Automation enabled: check if any message sentByAi
        automationEnabled = conversations.some(conv => conv.messages.some(m => m.sentByAi));
      }
    } else {
      // Pull from real data
      const conversations = await prisma.dmConversation.findMany({
        where: { clientId },
        include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
      });
      totalConversations = conversations.length;
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const messages = await prisma.dmMessage.findMany({
        where: {
          conversation: { clientId },
          createdAt: { gte: startOfMonth },
        },
      });
      messagesThisMonth = messages.length;
      const inbound = messages.filter(m => m.direction === "inbound").length;
      const outbound = messages.filter(m => m.direction === "outbound").length;
      replyRate = inbound > 0 ? Math.round((outbound / inbound) * 100) : 0;
      avgResponseTime = user.client.dmAutoReplyEnabled ? 1 : 8; // rough estimate
      recentConversations = conversations.slice(0, 5).map(conv => ({
        id: conv.id,
        customerName: conv.senderName || conv.instagramUserId,
        lastMessage: conv.messages[0]?.content || "",
        lastMessageTime: conv.messages[0]?.createdAt || conv.createdAt,
        status: conv.status,
        isAutoReplied: conv.messages.some(m => m.sentByAi),
      }));
      automationEnabled = user.client.dmAutoReplyEnabled;
    }

    res.json({
      totalConversations,
      messagesThisMonth,
      replyRate,
      avgResponseTime,
      recentConversations,
      automationEnabled,
      isDemoData,
    });
  } catch (error) {
    logger.error("Dashboard stats error", { message: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});