import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  delete: vi.fn(),
  create: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    notification: {
      findMany: hoisted.findMany,
      count: hoisted.count,
      findFirst: hoisted.findFirst,
      update: hoisted.update,
      updateMany: hoisted.updateMany,
      delete: hoisted.delete,
      create: hoisted.create
    },
    $transaction: hoisted.transaction
  }
}));

import {
  createNotification,
  deleteNotificationForUser,
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead
} from "../src/services/notificationService";

const baseRow = {
  id: "n1",
  userId: "u1",
  title: "Hello",
  body: "World",
  type: "info",
  read: false,
  readAt: null,
  metadata: null,
  createdAt: new Date("2026-04-01T12:00:00.000Z"),
  updatedAt: new Date("2026-04-01T12:00:00.000Z")
};

describe("notificationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.transaction.mockImplementation(async (arr: Promise<unknown>[]) => Promise.all(arr));
  });

  it("listNotificationsForUser returns rows and unreadCount", async () => {
    hoisted.findMany.mockResolvedValue([baseRow]);
    hoisted.count.mockResolvedValue(3);

    const out = await listNotificationsForUser("u1", {});

    expect(out.unreadCount).toBe(3);
    expect(out.notifications).toHaveLength(1);
    expect(out.notifications[0]).toMatchObject({
      id: "n1",
      userId: "u1",
      title: "Hello",
      body: "World",
      type: "info",
      read: false
    });
    expect(hoisted.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u1" },
        orderBy: { createdAt: "desc" },
        take: 50
      })
    );
  });

  it("listNotificationsForUser filters unread when unreadOnly is true", async () => {
    hoisted.findMany.mockResolvedValue([]);
    hoisted.count.mockResolvedValue(0);

    await listNotificationsForUser("u1", { unreadOnly: true, limit: 10 });

    expect(hoisted.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u1", read: false },
        take: 10
      })
    );
  });

  it("markNotificationRead updates and returns DTO", async () => {
    hoisted.findFirst.mockResolvedValue({ id: "n1" });
    const updated = { ...baseRow, read: true, readAt: new Date("2026-04-02T00:00:00.000Z") };
    hoisted.update.mockResolvedValue(updated);

    const out = await markNotificationRead("u1", "n1");

    expect(out?.read).toBe(true);
    expect(out?.readAt).toBe("2026-04-02T00:00:00.000Z");
    expect(hoisted.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "n1" },
        data: expect.objectContaining({ read: true })
      })
    );
  });

  it("markNotificationRead returns null when not found", async () => {
    hoisted.findFirst.mockResolvedValue(null);
    const out = await markNotificationRead("u1", "missing");
    expect(out).toBeNull();
    expect(hoisted.update).not.toHaveBeenCalled();
  });

  it("markAllNotificationsRead returns updated count", async () => {
    hoisted.updateMany.mockResolvedValue({ count: 4 });

    const out = await markAllNotificationsRead("u1");

    expect(out.updated).toBe(4);
    expect(hoisted.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u1", read: false },
        data: expect.objectContaining({ read: true })
      })
    );
  });

  it("deleteNotificationForUser deletes when owned", async () => {
    hoisted.findFirst.mockResolvedValue({ id: "n1" });
    hoisted.delete.mockResolvedValue(baseRow);

    const ok = await deleteNotificationForUser("u1", "n1");

    expect(ok).toBe(true);
    expect(hoisted.delete).toHaveBeenCalledWith({ where: { id: "n1" } });
  });

  it("deleteNotificationForUser returns false when missing", async () => {
    hoisted.findFirst.mockResolvedValue(null);
    const ok = await deleteNotificationForUser("u1", "x");
    expect(ok).toBe(false);
    expect(hoisted.delete).not.toHaveBeenCalled();
  });

  it("createNotification persists message as body", async () => {
    hoisted.create.mockResolvedValue({
      ...baseRow,
      body: "Msg",
      metadata: { a: 1 }
    });

    const out = await createNotification("u1", {
      type: "alert",
      title: "T",
      message: "Msg",
      metadata: { a: 1 }
    });

    expect(out.body).toBe("Msg");
    expect(hoisted.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "u1",
        type: "alert",
        title: "T",
        body: "Msg",
        metadata: { a: 1 }
      })
    });
  });
});
