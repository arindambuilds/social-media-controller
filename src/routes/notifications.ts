import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { tenantRateLimit } from "../middleware/tenantRateLimit";
import {
  createNotification,
  deleteNotificationForUser,
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead
} from "../services/notificationService";

export const notificationsRouter = Router();

notificationsRouter.use(authenticate);
notificationsRouter.use(tenantRateLimit);

const createBody = z.object({
  type: z.string().min(1),
  title: z.string().min(1),
  message: z.string().min(1),
  metadata: z.unknown().optional()
});

notificationsRouter.post("/", async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Please log in again." } });
      return;
    }

    const body = createBody.parse(req.body);
    const notification = await createNotification(userId, body);
    res.status(201).json({ success: true, notification });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create notification.";
    res.status(400).json({ success: false, error: { code: "NOTIFICATIONS_ERROR", message } });
  }
});

notificationsRouter.get("/", async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Please log in again." } });
      return;
    }

    const q = z
      .object({
        unread: z.enum(["true", "false", "1", "0"]).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional()
      })
      .parse(req.query);

    const unreadOnly = q.unread === "true" || q.unread === "1";
    const { notifications, unreadCount } = await listNotificationsForUser(userId, {
      unreadOnly,
      limit: q.limit
    });

    res.json({
      success: true,
      notifications,
      unreadCount
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load notifications.";
    res.status(400).json({ success: false, error: { code: "NOTIFICATIONS_ERROR", message } });
  }
});

notificationsRouter.patch("/read-all", async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Please log in again." } });
      return;
    }

    const result = await markAllNotificationsRead(userId);
    res.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to mark notifications read.";
    res.status(500).json({ success: false, error: { code: "NOTIFICATIONS_ERROR", message } });
  }
});

notificationsRouter.patch("/:id/read", async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Please log in again." } });
      return;
    }

    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const updated = await markNotificationRead(userId, id);
    if (!updated) {
      res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Notification not found." } });
      return;
    }

    res.json({ success: true, notification: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update notification.";
    res.status(400).json({ success: false, error: { code: "NOTIFICATIONS_ERROR", message } });
  }
});

notificationsRouter.delete("/:id", async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Please log in again." } });
      return;
    }

    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const deleted = await deleteNotificationForUser(userId, id);
    if (!deleted) {
      res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Notification not found." } });
      return;
    }

    res.status(204).send();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete notification.";
    res.status(400).json({ success: false, error: { code: "NOTIFICATIONS_ERROR", message } });
  }
});
