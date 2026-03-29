import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { resolveTenant } from "../middleware/resolveTenant";
import { requireRole } from "../middleware/requireRole";

export const clientsRouter = Router();

clientsRouter.use(authenticate);

const dmToneValues = ["friendly", "professional", "casual"] as const;

const dmSettingsSchema = z.object({
  dmAutoReplyEnabled: z.boolean().optional(),
  dmBusinessContext: z.string().max(1000).nullable().optional(),
  dmOwnerTone: z.enum(dmToneValues).nullable().optional(),
  whatsappNumber: z
    .string()
    .max(40)
    .nullable()
    .optional()
    .refine(
      (val) =>
        val === undefined ||
        val === null ||
        val === "" ||
        (/^\+[\d\s]+$/.test(val) && /\d/.test(val.replace(/\s/g, ""))),
      { message: "WhatsApp number must start with + and use only digits and spaces." }
    )
});

clientsRouter.get("/:clientId/dm-settings", resolveTenant, requireRole("AGENCY_ADMIN", "CLIENT_USER"), async (req, res) => {
  const { clientId } = z.object({ clientId: z.string().min(1) }).parse(req.params);

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      dmAutoReplyEnabled: true,
      dmBusinessContext: true,
      dmOwnerTone: true,
      whatsappNumber: true
    }
  });

  if (!client) {
    res.status(404).json({ error: "Client not found." });
    return;
  }

  res.json({ success: true, client });
});

clientsRouter.patch("/:clientId/dm-settings", resolveTenant, requireRole("AGENCY_ADMIN", "CLIENT_USER"), async (req, res) => {
  const { clientId } = z.object({ clientId: z.string().min(1) }).parse(req.params);
  const body = dmSettingsSchema.parse(req.body ?? {});

  if (Object.keys(body).length === 0) {
    res.status(400).json({ error: "No fields to update." });
    return;
  }

  const data: Record<string, unknown> = {};
  if (body.dmAutoReplyEnabled !== undefined) data.dmAutoReplyEnabled = body.dmAutoReplyEnabled;
  if (body.dmBusinessContext !== undefined) data.dmBusinessContext = body.dmBusinessContext;
  if (body.dmOwnerTone !== undefined) data.dmOwnerTone = body.dmOwnerTone;
  if (body.whatsappNumber !== undefined) {
    const w = body.whatsappNumber;
    data.whatsappNumber = w === "" || w === null ? null : w;
  }

  const client = await prisma.client.update({
    where: { id: clientId },
    data: data as {
      dmAutoReplyEnabled?: boolean;
      dmBusinessContext?: string | null;
      dmOwnerTone?: string | null;
      whatsappNumber?: string | null;
    },
    select: {
      id: true,
      dmAutoReplyEnabled: true,
      dmBusinessContext: true,
      dmOwnerTone: true,
      whatsappNumber: true
    }
  });

  res.json({ success: true, client });
});

clientsRouter.get(
  "/:clientId/dm-conversations/:conversationId/messages",
  resolveTenant,
  requireRole("AGENCY_ADMIN", "CLIENT_USER"),
  async (req, res) => {
    const { clientId, conversationId } = z
      .object({ clientId: z.string().min(1), conversationId: z.string().min(1) })
      .parse(req.params);

    const conv = await prisma.dmConversation.findFirst({
      where: { id: conversationId, clientId },
      select: { id: true }
    });

    if (!conv) {
      res.status(404).json({ error: "Conversation not found." });
      return;
    }

    const rows = await prisma.dmMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        direction: true,
        content: true,
        createdAt: true,
        sentByAi: true,
        confidence: true
      }
    });

    const messages = rows.map((m) => ({
      id: m.id,
      direction: m.direction === "outbound" ? ("outbound" as const) : ("inbound" as const),
      content: m.content,
      sentAt: m.createdAt.toISOString(),
      isAutoReply: m.sentByAi,
      confidenceScore: m.confidence
    }));

    res.json(messages);
  }
);

clientsRouter.get("/:clientId/dm-conversations", resolveTenant, requireRole("AGENCY_ADMIN", "CLIENT_USER"), async (req, res) => {
  const { clientId } = z.object({ clientId: z.string().min(1) }).parse(req.params);

  const rows = await prisma.dmConversation.findMany({
    where: { clientId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      instagramUserId: true,
      senderName: true,
      status: true,
      updatedAt: true,
      _count: { select: { messages: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, createdAt: true }
      }
    }
  });

  const list = rows.map((r) => {
    const last = r.messages[0];
    return {
      id: r.id,
      contactName: r.senderName,
      instagramUserId: r.instagramUserId,
      lastMessage: last?.content ?? "",
      lastMessageAt: (last?.createdAt ?? r.updatedAt).toISOString(),
      messageCount: r._count.messages,
      resolved: r.status === "resolved"
    };
  });

  res.json(list);
});

clientsRouter.get("/:clientId/sync-status", resolveTenant, async (req, res) => {
  const { clientId } = z.object({ clientId: z.string().min(1) }).parse(req.params);

  const ig = await prisma.socialAccount.findFirst({
    where: { clientId, platform: "INSTAGRAM" }
  });

  if (!ig) {
    res.json({
      status: "idle" as const,
      postsSynced: 0,
      instagramConnected: false,
      lastSyncedAt: null as string | null
    });
    return;
  }

  const postsSynced = await prisma.post.count({ where: { socialAccountId: ig.id } });
  const ageMs = Date.now() - ig.createdAt.getTime();
  const syncing = postsSynced === 0 && ageMs < 3 * 60 * 1000;

  res.json({
    status: syncing ? ("syncing" as const) : ("completed" as const),
    postsSynced,
    instagramConnected: true,
    lastSyncedAt: ig.lastSyncedAt?.toISOString() ?? null
  });
});

clientsRouter.get("/", requireRole("AGENCY_ADMIN"), async (_req, res) => {
  const clients = await prisma.client.findMany({
    include: {
      socialAccounts: true,
      leads: true
    }
  });

  res.json(clients);
});

clientsRouter.post("/", requireRole("AGENCY_ADMIN"), async (req, res) => {
  const bodySchema = z.object({
    name: z.string().min(2),
    ownerId: z.string().min(1),
    agencyId: z.string().optional()
  });

  const payload = bodySchema.parse(req.body);

  const client = await prisma.client.create({
    data: {
      name: payload.name,
      ownerId: payload.ownerId,
      agencyId: payload.agencyId
    }
  });

  res.status(201).json(client);
});
