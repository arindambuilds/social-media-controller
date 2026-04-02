import type { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { tenantRateLimit } from "../middleware/tenantRateLimit";
import { writeAuditLog } from "../services/auditLogService";

export const leadsRouter = Router();

leadsRouter.use(authenticate);
leadsRouter.use(tenantRateLimit);

leadsRouter.get("/", requireRole("AGENCY_ADMIN", "CLIENT_USER"), async (req, res) => {
  const qClientId = z.string().optional().parse(req.query.clientId);
  const agencyIdFilter = z.string().optional().parse(req.query.agencyId);
  const page = z.coerce.number().int().min(1).default(1).parse(req.query.page ?? 1);
  const limit = z.coerce.number().int().min(1).max(100).default(20).parse(req.query.limit ?? 20);
  const skip = (page - 1) * limit;

  let where: Prisma.LeadWhereInput = {};

  if (req.auth?.role === "CLIENT_USER") {
    if (!req.auth.clientId) {
      res.status(400).json({ error: "No client assigned to this account." });
      return;
    }
    where = { clientId: req.auth.clientId };
  } else {
    const uid = req.auth!.userId;
    if (qClientId) {
      where = { clientId: qClientId };
    } else if (agencyIdFilter) {
      where = { client: { agencyId: agencyIdFilter } };
    } else {
      where = {
        OR: [{ client: { agencyId: uid } }, { client: { ownerId: uid } }]
      };
    }
  }

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            socialAccounts: {
              where: { platform: "INSTAGRAM" },
              select: {
                platformUsername: true,
                lastSyncedAt: true,
                followerCount: true
              }
            }
          }
        }
      }
    }),
    prisma.lead.count({ where })
  ]);

  res.json({
    success: true,
    leads,
    /** Total rows matching filters (all pages); smoke tests expect this top-level key. */
    total,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0
    }
  });
});

leadsRouter.patch("/:id", requireRole("AGENCY_ADMIN", "CLIENT_USER"), async (req, res) => {
  const params = z.object({ id: z.string().min(1) }).parse(req.params);
  const payload = z
    .object({
      status: z.enum(["NEW", "CONTACTED", "CONVERTED", "LOST"])
    })
    .parse(req.body);

  const existing = await prisma.lead.findUnique({ where: { id: params.id } });
  if (!existing) {
    res.status(404).json({ error: "Lead not found." });
    return;
  }
  if (req.auth?.role === "CLIENT_USER" && req.auth.clientId !== existing.clientId) {
    res.status(403).json({ error: "Forbidden for this client." });
    return;
  }

  const lead = await prisma.lead.update({
    where: { id: params.id },
    data: { status: payload.status }
  });

  await writeAuditLog({
    clientId: existing.clientId,
    actorId: req.auth?.userId,
    action: "LEAD_STATUS_UPDATED",
    entityType: "Lead",
    entityId: lead.id,
    metadata: { fromStatus: existing.status, toStatus: payload.status },
    ipAddress: req.ip
  });

  res.json({ success: true, lead });
});
