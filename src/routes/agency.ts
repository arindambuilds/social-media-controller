import { Router } from "express";
import fs from "fs";
import multer from "multer";
import path from "path";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { authenticate } from "../middleware/authenticate";
import { requireAgency } from "../middleware/requireAgency";

type PlanTier = "free" | "starter" | "growth" | "agency";

const PLAN_LIMITS: Record<
  PlanTier,
  { briefings: number | null; reportExports: number | null; voiceGenerations: number | null; scheduledReports: number | null; clients: number | null }
> = {
  free: { briefings: 5, reportExports: 3, voiceGenerations: 3, scheduledReports: 0, clients: 1 },
  starter: { briefings: 50, reportExports: 20, voiceGenerations: 20, scheduledReports: 3, clients: 5 },
  growth: { briefings: null, reportExports: 100, voiceGenerations: 100, scheduledReports: 10, clients: 15 },
  agency: { briefings: null, reportExports: null, voiceGenerations: null, scheduledReports: null, clients: null }
};

function monthBounds(now = new Date()): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function inferPlan(clientCount: number): PlanTier {
  if (clientCount <= 1) return "free";
  if (clientCount <= 5) return "starter";
  if (clientCount <= 15) return "growth";
  return "agency";
}

function normalizePlan(plan: string | null | undefined): PlanTier | null {
  if (plan === "free" || plan === "starter" || plan === "growth" || plan === "agency") return plan;
  return null;
}

export const agencyRouter = Router();

const LOGO_DIR = path.join(process.cwd(), "uploads", "logos");
fs.mkdirSync(LOGO_DIR, { recursive: true });

const upload = multer({
  dest: LOGO_DIR,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];
    cb(null, allowed.includes(file.mimetype));
  }
});

agencyRouter.use(authenticate);
agencyRouter.use(requireAgency);

agencyRouter.get("/usage", async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Please log in again." } });
      return;
    }

    const { start, end } = monthBounds();

    const linkedClientRows = await prisma.client.findMany({
      where: {
        OR: [{ agencyId: userId }, { ownerId: userId }, { users: { some: { id: userId } } }]
      },
      select: { id: true }
    });

    const fallbackClientId = req.auth?.clientId;
    const clientIds = Array.from(new Set([...linkedClientRows.map((c) => c.id), ...(fallbackClientId ? [fallbackClientId] : [])]));
    const agencyUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true }
    });

    if (clientIds.length === 0) {
      res.json({
        plan: normalizePlan(agencyUser?.plan) ?? ("free" as PlanTier),
        billingPeriod: { start: start.toISOString(), end: end.toISOString() },
        usage: {
          briefings: { used: 0, limit: PLAN_LIMITS.free.briefings },
          reportExports: { used: 0, limit: PLAN_LIMITS.free.reportExports },
          voiceGenerations: { used: 0, limit: PLAN_LIMITS.free.voiceGenerations },
          scheduledReports: { used: 0, limit: PLAN_LIMITS.free.scheduledReports },
          clients: { used: 0, limit: PLAN_LIMITS.free.clients }
        }
      });
      return;
    }

    const safeCount = async (fn: () => Promise<number>): Promise<number> => {
      try {
        return await fn();
      } catch (err) {
        const code = (err as { code?: string } | null)?.code;
        if (code === "P2021" || code === "P2022") return 0;
        throw err;
      }
    };

    const [briefings, reportExports, voiceGenerations, scheduledReports, clients] = await Promise.all([
      safeCount(() => prisma.briefing.count({ where: { clientId: { in: clientIds }, createdAt: { gte: start, lte: end } } })),
      safeCount(() =>
        prisma.auditLog.count({
          where: {
            clientId: { in: clientIds },
            createdAt: { gte: start, lte: end },
            action: { in: ["BRIEFING_EXPORTED_PDF", "REPORT_EXPORTED_PDF"] }
          }
        })
      ),
      safeCount(() =>
        prisma.aiUsageLog.count({
          where: {
            clientId: { in: clientIds },
            createdAt: { gte: start, lte: end },
            feature: { in: ["voice_generation", "voice_post_generate", "voice_post"] }
          }
        })
      ),
      safeCount(() => prisma.client.count({ where: { id: { in: clientIds }, briefingEnabled: true } })),
      safeCount(() => prisma.client.count({ where: { id: { in: clientIds } } }))
    ]);

    const plan = normalizePlan(agencyUser?.plan) ?? inferPlan(clients);
    const limits = PLAN_LIMITS[plan];

    res.json({
      plan,
      billingPeriod: { start: start.toISOString(), end: end.toISOString() },
      usage: {
        briefings: { used: briefings, limit: limits.briefings },
        reportExports: { used: reportExports, limit: limits.reportExports },
        voiceGenerations: { used: voiceGenerations, limit: limits.voiceGenerations },
        scheduledReports: { used: scheduledReports, limit: limits.scheduledReports },
        clients: { used: clients, limit: limits.clients }
      }
    });
  } catch (err) {
    // Keep frontend stable with explicit route-level failure payload.
    logger.error("[GET /api/agency/usage] failed", {
      message: err instanceof Error ? err.message : String(err)
    });
    res.status(500).json({ error: "Failed to load usage data" });
  }
});

agencyRouter.get("/branding", async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ error: "Please log in again." });
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { agencyName: true, brandColor: true, logoUrl: true, name: true }
    });

    res.json({
      agencyName: user?.agencyName ?? user?.name ?? "",
      brandColor: user?.brandColor ?? "#06b6d4",
      logoUrl: user?.logoUrl ?? null
    });
  } catch (err) {
    logger.error("[GET /api/agency/branding] failed", {
      message: err instanceof Error ? err.message : String(err)
    });
    res.status(500).json({ error: "Failed to load branding" });
  }
});

agencyRouter.post("/branding", async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ error: "Please log in again." });
      return;
    }
    const body = (req.body ?? {}) as { brandColor?: string; agencyName?: string; logoUrl?: string | null };
    const color = typeof body.brandColor === "string" && /^#[0-9a-fA-F]{6}$/.test(body.brandColor)
      ? body.brandColor
      : "#06b6d4";
    const agencyName = typeof body.agencyName === "string" ? body.agencyName.trim().slice(0, 120) : "";

    await prisma.user.update({
      where: { id: userId },
      data: {
        brandColor: color,
        agencyName,
        ...(body.logoUrl === null ? { logoUrl: null } : {})
      }
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error("[POST /api/agency/branding] failed", {
      message: err instanceof Error ? err.message : String(err)
    });
    res.status(500).json({ error: "Failed to save branding" });
  }
});

agencyRouter.post("/branding/logo", upload.single("file"), async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ error: "Please log in again." });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    const ext = path.extname(req.file.originalname || "").toLowerCase() || ".png";
    const filename = `logo-${userId}-${Date.now()}${ext}`;
    const destPath = path.join(LOGO_DIR, filename);
    fs.renameSync(req.file.path, destPath);

    const logoUrl = `/uploads/logos/${filename}`;
    await prisma.user.update({
      where: { id: userId },
      data: { logoUrl }
    });
    res.json({ url: logoUrl });
  } catch (err) {
    logger.error("[POST /api/agency/branding/logo] failed", {
      message: err instanceof Error ? err.message : String(err)
    });
    res.status(500).json({ error: "Logo upload failed" });
  }
});
