import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { requireAgency } from "../middleware/requireAgency";
import { tenantRateLimit } from "../middleware/tenantRateLimit";

export const auditLogsRouter = Router();

auditLogsRouter.use(authenticate);
auditLogsRouter.use(requireAgency);
auditLogsRouter.use(tenantRateLimit);

auditLogsRouter.get("/", async (req, res) => {
  const q = z
    .object({
      clientId: z.string().min(1),
      page: z.coerce.number().int().min(1).default(1),
      perPage: z.coerce.number().int().min(1).max(100).default(20),
      action: z.string().optional()
    })
    .parse(req.query);

  const skip = (q.page - 1) * q.perPage;

  const where = {
    clientId: q.clientId,
    ...(q.action ? { action: q.action } : {})
  };

  const [total, rows] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: q.perPage
    })
  ]);

  res.json({
    success: true,
    logs: rows,
    pagination: { page: q.page, perPage: q.perPage, total }
  });
});
