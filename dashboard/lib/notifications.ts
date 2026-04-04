import { apiFetch, API_URL } from "./api";

/** Matches API `NotificationDto` (message text stored as `body`). */
export type Notification = {
  id: string;
  userId: string;
  title: string;
  body: string | null;
  type: string;
  read: boolean;
  readAt: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
};

export type CreateNotificationBody = {
  type: string;
  title: string;
  message: string;
  metadata?: unknown;
};

export async function getNotifications(
  unread?: boolean,
  limit?: number
): Promise<{ notifications: Notification[]; unreadCount: number }> {
  const params = new URLSearchParams();
  if (unread === true) params.set("unread", "true");
  if (typeof limit === "number") params.set("limit", String(limit));
  const q = params.toString();
  const path = `/notifications${q ? `?${q}` : ""}`;
  return apiFetch<{ success: boolean; notifications: Notification[]; unreadCount: number }>(path);
}

export async function createNotification(data: CreateNotificationBody): Promise<Notification> {
  const res = await apiFetch<{ success: boolean; notification: Notification }>("/notifications", {
    method: "POST",
    body: JSON.stringify(data)
  });
  return res.notification;
}

export async function markAsRead(id: string): Promise<void> {
  await apiFetch(`/notifications/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
    body: JSON.stringify({})
  });
}

export async function markAllAsRead(): Promise<void> {
  await apiFetch("/notifications/read-all", {
    method: "PATCH",
    body: JSON.stringify({})
  });
}

export async function deleteNotification(id: string): Promise<void> {
  await apiFetch(`/notifications/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** Base `/api` URL (same as `apiFetch`). */
export function notificationsApiBase(): string {
  return API_URL;
}
