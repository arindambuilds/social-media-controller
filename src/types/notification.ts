/** Serializable notification row for API responses. */
export type NotificationDto = {
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

/** Body for POST /api/notifications (maps `message` → stored `body`). */
export type CreateNotificationInput = {
  type: string;
  title: string;
  message: string;
  metadata?: unknown;
};
