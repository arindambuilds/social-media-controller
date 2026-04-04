import { redisConnection } from "./redis";
import { logger } from "./logger";

const channel = (userId: string) => `notifications:${userId}`;

/** Payload emitted as SSE `event: notification` (data is JSON string). */
export type NotificationSsePayload = {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
};

/**
 * Push a user-scoped notification to active SSE connections (see `attachSseRoute`).
 * No-op if Redis is unavailable; never throws.
 */
export function publishNotificationToUser(userId: string, notification: NotificationSsePayload): void {
  if (!redisConnection) return;
  try {
    const envelope = JSON.stringify({
      type: "notification",
      data: notification
    });
    void redisConnection.publish(channel(userId), envelope).catch((err) => {
      logger.warn("publishNotificationToUser failed", {
        userId,
        message: err instanceof Error ? err.message : String(err)
      });
    });
  } catch (err) {
    logger.warn("publishNotificationToUser failed", {
      userId,
      message: err instanceof Error ? err.message : String(err)
    });
  }
}
