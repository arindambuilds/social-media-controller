import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "../lib/logger";

type AuditLogInput = {
  /** Omit or null for user-level events before a client exists (e.g. public signup). */
  clientId?: string | null;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
};

export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        clientId: input.clientId ?? null,
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata,
        ipAddress: input.ipAddress ?? null
      }
    });
  } catch (err) {
    logger.warn("Audit log write failed", {
      action: input.action,
      clientId: input.clientId,
      entityType: input.entityType,
      entityId: input.entityId,
      message: err instanceof Error ? err.message : String(err)
    });
  }
}
