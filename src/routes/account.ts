import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { logger } from "../lib/logger";
import { writeAuditLog } from "../services/auditLogService";

export const accountRouter = Router();

accountRouter.use(authenticate);

/**
 * DELETE /api/account
 * GDPR right to erasure — permanently deletes the authenticated user and all their data.
 * Requires confirmation body: { confirm: "DELETE" }
 */
accountRouter.delete("/", async (req, res) => {
  const body = z.object({ confirm: z.literal("DELETE") }).parse(req.body);
  void body; // validated

  const userId = req.auth!.userId;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, clientId: true }
    });

    if (!user) {
      res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "User not found." } });
      return;
    }

    // Log before deletion (audit log will cascade-delete with client)
    logger.info("[account] delete requested", { userId, email: "[REDACTED]" });

    // Delete user — Prisma cascade handles: DemoData, Notifications, Reports, BriefingFeedback
    // Client cascade handles: SocialAccounts, Posts, Campaigns, Leads, AuditLogs, Briefings, etc.
    await prisma.user.delete({ where: { id: userId } });

    logger.info("[account] user deleted", { userId });

    res.json({ success: true, message: "Your account and all associated data have been permanently deleted." });
  } catch (err) {
    logger.error("[account] delete failed", {
      userId,
      message: err instanceof Error ? err.message : String(err)
    });
    res.status(500).json({
      success: false,
      error: { code: "DELETE_FAILED", message: "Account deletion failed. Please contact support." }
    });
  }
});

/**
 * GET /api/account/export
 * GDPR data portability — returns all user data as JSON.
 */
accountRouter.get("/export", async (req, res) => {
  const userId = req.auth!.userId;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        agencyName: true,
        businessName: true,
        businessType: true,
        role: true,
        plan: true,
        createdAt: true,
        onboardingCompleted: true,
        clientId: true
      }
    });

    if (!user) {
      res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "User not found." } });
      return;
    }

    // Fetch associated data
    const [notifications, reports, briefings, conversations] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        select: { title: true, body: true, type: true, read: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 500
      }),
      user.clientId
        ? prisma.report.findMany({
            where: { userId },
            select: { reportType: true, pdfStatus: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 100
          })
        : [],
      user.clientId
        ? prisma.briefing.findMany({
            where: { clientId: user.clientId },
            select: { content: true, sentAt: true, whatsappDelivered: true, emailDelivered: true },
            orderBy: { sentAt: "desc" },
            take: 365
          })
        : [],
      user.clientId
        ? prisma.dmConversation.findMany({
            where: { clientId: user.clientId },
            select: {
              instagramUserId: true,
              senderName: true,
              status: true,
              createdAt: true,
              messages: {
                select: { direction: true, content: true, sentByAi: true, createdAt: true },
                orderBy: { createdAt: "asc" },
                take: 100
              }
            },
            orderBy: { createdAt: "desc" },
            take: 100
          })
        : []
    ]);

    await writeAuditLog({
      clientId: user.clientId ?? null,
      actorId: userId,
      action: "DATA_EXPORT_REQUESTED",
      entityType: "User",
      entityId: userId,
      metadata: { exportedAt: new Date().toISOString() },
      ipAddress: req.ip
    });

    const exportData = {
      exportedAt: new Date().toISOString(),
      account: user,
      notifications,
      reports,
      briefings,
      conversations
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="pulseos-data-export-${userId}.json"`);
    res.json(exportData);
  } catch (err) {
    logger.error("[account] export failed", {
      userId,
      message: err instanceof Error ? err.message : String(err)
    });
    res.status(500).json({
      success: false,
      error: { code: "EXPORT_FAILED", message: "Data export failed. Please try again." }
    });
  }
});
