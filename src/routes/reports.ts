import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { resolveTenant } from "../middleware/resolveTenant";
import { reportPdfExportLimiter } from "../middleware/rateLimiter";
import { tenantRateLimit } from "../middleware/tenantRateLimit";
import { writeAuditLog } from "../services/auditLogService";
import { PdfService } from "../services/pdfService";
import { buildClientReportHtml } from "../services/reportHtmlBuilder";
import { CircuitOpenError, pdfExportCircuit } from "../lib/circuitBreaker";
import { pdfJobTierForRole } from "../lib/pdfFairPriority";
import { enqueuePdfGenerationAndWait, pdfQueue, PdfQueueOverloadedError } from "../queues/pdfQueue";

export const reportsRouter = Router();

reportsRouter.use(authenticate);
reportsRouter.use(tenantRateLimit);

const FREE_MONTHLY_EXPORT_LIMIT = 5;

reportsRouter.post("/:clientId/export/pdf", reportPdfExportLimiter, resolveTenant, async (req, res) => {
  try {
    const { clientId } = z.object({ clientId: z.string().min(1) }).parse(req.params);
    const body = z
      .object({
        reportType: z.enum(["briefing", "analytics"]).optional()
      })
      .strict()
      .parse((req.body as unknown) ?? {});
    const reportType = body.reportType ?? "briefing";

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

    let pdf: Buffer;
    let hasQuickChart: boolean;

    /** Vitest often has REDIS_URL but no PDF worker — keep synchronous PdfService + spy-friendly path. */
    const usePdfQueue = pdfQueue && process.env.NODE_ENV !== "test";

    if (usePdfQueue) {
      const tier = pdfJobTierForRole(user?.role);
      const out = await enqueuePdfGenerationAndWait({ clientId, userId, reportType }, 120_000, {
        tier
      });
      pdf = out.pdf;
      hasQuickChart = out.hasQuickChart;
    } else {
      const built = await buildClientReportHtml({ clientId, userId, reportType });
      hasQuickChart = built.html.includes("quickchart.io/chart");
      pdf = await pdfExportCircuit.execute(async () =>
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
    }

    const periodLabel = "Last 30 days";

    await writeAuditLog({
      clientId,
      actorId: userId,
      action: "REPORT_EXPORTED_PDF",
      entityType: "Client",
      entityId: clientId,
      metadata: { period: periodLabel },
      ipAddress: req.ip
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="report.pdf"');
    if (process.env.NODE_ENV === "test") {
      res.setHeader("X-Report-Has-Charts", hasQuickChart ? "1" : "0");
      res.setHeader("X-Report-Watermark", applyWatermark ? "1" : "0");
    }
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
});
