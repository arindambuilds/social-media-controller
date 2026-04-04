import type { Prisma } from "@prisma/client";
import { publishNotificationToUser } from "../lib/notificationSse";
import { prisma } from "../lib/prisma";
import type { CreateNotificationInput, NotificationDto } from "../types/notification";

function toDto(row: {
  id: string;
  userId: string;
  title: string;
  body: string | null;
  type: string;
  read: boolean;
  readAt: Date | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}): NotificationDto {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    body: row.body,
    type: row.type,
    read: row.read,
    readAt: row.readAt?.toISOString() ?? null,
    metadata: row.metadata ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export async function createNotification(
  userId: string,
  input: CreateNotificationInput
): Promise<NotificationDto> {
  const metadata =
    input.metadata === undefined ? undefined : (input.metadata as Prisma.InputJsonValue);
  const row = await prisma.notification.create({
    data: {
      userId,
      type: input.type,
      title: input.title,
      body: input.message,
      ...(metadata !== undefined ? { metadata } : {})
    }
  });
  try {
    publishNotificationToUser(userId, {
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.body ?? "",
      createdAt: row.createdAt.toISOString()
    });
  } catch {
    /* SSE emit must never fail create */
  }
  return toDto(row);
}

/** Alias for programmatic use (hooks, workers). */
export const create = createNotification;

export async function listNotificationsForUser(
  userId: string,
  options: { unreadOnly?: boolean; limit?: number } = {}
): Promise<{ notifications: NotificationDto[]; unreadCount: number }> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(options.unreadOnly ? { read: false } : {})
  };

  const [rows, unreadCount] = await prisma.$transaction([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit
    }),
    prisma.notification.count({ where: { userId, read: false } })
  ]);

  return {
    notifications: rows.map(toDto),
    unreadCount
  };
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<NotificationDto | null> {
  const existing = await prisma.notification.findFirst({
    where: { id: notificationId, userId }
  });
  if (!existing) return null;

  const now = new Date();
  const row = await prisma.notification.update({
    where: { id: notificationId },
    data: { read: true, readAt: now }
  });
  return toDto(row);
}

export async function markAllNotificationsRead(userId: string): Promise<{ updated: number }> {
  const result = await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true, readAt: new Date() }
  });
  return { updated: result.count };
}

export async function deleteNotificationForUser(userId: string, notificationId: string): Promise<boolean> {
  const existing = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
    select: { id: true }
  });
  if (!existing) return false;

  await prisma.notification.delete({ where: { id: notificationId } });
  return true;
}
