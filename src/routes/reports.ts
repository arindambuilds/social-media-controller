import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { authenticate } from "../middleware/authenticate";
import { resolveTenant, resolveTenantFromBody } from "../middleware/resolveTenant";
import { reportPdfExportLimiter } from "../middleware/rateLimiter";
import { tenantRateLimit } from "../middleware/tenantRateLimit";
import { writeAuditLog } from "../services/auditLogService";
import { PdfService } from "../services/pdfService";
import { buildClientReportHtml } from "../services/reportHtmlBuilder";
import { CircuitOpenError, pdfExportCircuit } from "../lib/circuitBreaker";
import { pdfJobTierForRole } from "../lib/pdfFairPriority";
import {
  enqueuePdfJob,
  pdfQueue,
  PdfQueueOverloadedError
} from "../queues/pdfQueue";
import {
  createReport,
  getReportStatus,
  saveReportPdf,
  updateReportStatus
} from "../services/reportService";

export const reportsRouter = Router();

reportsRouter.use(authenticate);
reportsRouter.use(tenantRateLimit);

const FREE_MONTHLY_EXPORT_LIMIT = 5;

async function exportClientPdf(
  req: Request,
  res: Response,
  clientId: string,
  reportType: "briefing" | "analytics"
): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ error: "Please log in again." });
      return;
    }

    const [user, client] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true, role: true }
      }),
      prisma.client.findUnique({ where: { id: clientId }, select: { id: true, name: true } })
    ]);

    if (!client) {
      res.status(404).json({ error: "Client not found." });
      return;
    }

    const isFreePlan = (user?.plan ?? "free") === "free";
    const applyWatermark = isFreePlan;
    if (isFreePlan) {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      const exportsThisMonth = await prisma.auditLog.count({
        where: {
          actorId: userId,
          action: "REPORT_EXPORTED_PDF",
          createdAt: { gte: monthStart, lte: monthEnd }
        }
      });
      if (exportsThisMonth >= FREE_MONTHLY_EXPORT_LIMIT) {
        res.status(403).json({ error: "Free plan limit reached. Upgrade to continue exporting." });
        return;
      }
    }

    const report = await createReport({ clientId, userId, reportType });

    if (pdfQueue && process.env.NODE_ENV !== "test") {
      const tier = pdfJobTierForRole(user?.role);
      const job = await enqueuePdfJob(
        {
          clientId,
          userId,
          reportType,
          reportId: report.id,
          pdfRoleBase: tier,
          enqueuedAtMs: Date.now()
        },
        {
          priority: tier,
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
          jobId: report.id
        }
      );
      await updateReportStatus(report.id, "queued", { pdfJobId: String(job.id) });
      await writeAuditLog({
        clientId,
        actorId: userId,
        action: "REPORT_EXPORTED_PDF",
        entityType: "Client",
        entityId: clientId,
        metadata: { period: "Last 30 days", reportId: report.id, queued: true },
        ipAddress: req.ip
      });
      res.status(202).json({ jobId: String(job.id), reportId: report.id, status: "queued" });
      return;
    }

    logger.error({
      msg: 'PDF queue unavailable — falling back to synchronous inline generation. OOM risk at concurrent load.',
      reportId: report.id,
      userId,
    });

    const built = await buildClientReportHtml({ clientId, userId, reportType });
    const hasQuickChart = built.html.includes("quickchart.io/chart");
    const pdf = await pdfExportCircuit.execute(async () =>
      PdfService.generatePdf({
        html: built.html,
        options: {
          format: "A4",
          margin: { top: "16mm", right: "12mm", bottom: "16mm", left: "12mm" },
          displayHeaderFooter: true,
          footerTemplate: built.footerTemplate,
          timeoutMs: built.timeoutMs
        }
      })
    );

    const pdfUrl = await saveReportPdf(report.id, pdf);
    await updateReportStatus(report.id, "ready", { pdfUrl });
    await writeAuditLog({
      clientId,
      actorId: userId,
      action: "REPORT_EXPORTED_PDF",
      entityType: "Client",
      entityId: clientId,
      metadata: { period: "Last 30 days", reportId: report.id },
      ipAddress: req.ip
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="report.pdf"');
    res.setHeader("X-Report-Watermark", applyWatermark ? "1" : "0");
    res.setHeader("X-Report-Has-Charts", hasQuickChart ? "1" : "0");
    res.status(200).send(pdf);
  } catch (err) {
    if (err instanceof CircuitOpenError) {
      res.status(503).json({ error: "PDF export is temporarily unavailable. Try again in a minute." });
      return;
    }
    if (err instanceof PdfQueueOverloadedError) {
      res.status(503).json({ error: "PDF export is temporarily overloaded. Try again shortly." });
      return;
    }
    const message = err instanceof Error ? err.message : "PDF export failed.";
    const status = /PUPPETEER_EXECUTABLE_PATH|timed out|PDF queue|PDF worker|PDF_OVERLOADED|CIRCUIT_OPEN/i.test(
      message
    )
      ? 503
      : 500;
    res.status(status).json({ error: message });
  }
}

reportsRouter.get("/:reportId/status", authenticate, tenantRateLimit, async (req, res) => {
  const { reportId } = z.object({ reportId: z.string().min(1) }).parse(req.params);
  const report = await getReportStatus(reportId);
  if (!report) {
    res.status(404).json({ error: "Report not found." });
    return;
  }
  if (req.auth?.role === "CLIENT_USER" && req.auth.clientId !== report.clientId) {
    res.status(403).json({ error: "Forbidden for this report." });
    return;
  }
  res.status(200).json({
    reportId: report.id,
    status: report.pdfStatus,
    url: report.pdfUrl ?? undefined,
    failureReason: report.failureReason ?? undefined
  });
});

/** POST /api/reports — same PDF export as `/:clientId/export/pdf`, clientId in JSON body. */
reportsRouter.post(
  "/",
  reportPdfExportLimiter,
  resolveTenantFromBody("clientId"),
  async (req, res) => {
    const raw = (req.body ?? {}) as Record<string, unknown>;
    const clientId = typeof raw.clientId === "string" ? raw.clientId : "";
    const body = z
      .object({
        reportType: z.enum(["briefing", "analytics"]).optional()
      })
      .strict()
      .parse((req.body as unknown) ?? {});
    const reportType = body.reportType ?? "briefing";
    await exportClientPdf(req, res, clientId, reportType);
  }
);

reportsRouter.post("/:clientId/export/pdf", reportPdfExportLimiter, resolveTenant, async (req, res) => {
  const { clientId } = z.object({ clientId: z.string().min(1) }).parse(req.params);
  const body = z
    .object({
      reportType: z.enum(["briefing", "analytics"]).optional()
    })
    .strict()
    .parse((req.body as unknown) ?? {});
  const reportType = body.reportType ?? "briefing";
  await exportClientPdf(req, res, clientId, reportType);
});
