import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

export type SystemEventLevel = "info" | "warn" | "error";

export async function logSystemEvent(
  category: string,
  level: SystemEventLevel,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.systemEvent.create({
      data: {
        category,
        level,
        message: message.slice(0, 2000),
        metadata: metadata ? (metadata as object) : undefined
      }
    });
  } catch (err) {
    logger.warn("logSystemEvent failed", {
      category,
      message: err instanceof Error ? err.message : String(err)
    });
  }
}
