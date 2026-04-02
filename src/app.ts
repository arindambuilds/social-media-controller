import * as Sentry from "@sentry/node";
import { setupExpressErrorHandler } from "@sentry/node";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { env } from "./config/env";
import cron from "node-cron";
import { runWeeklyDatabaseCleanup } from "./jobs/databaseCleanup";
import { startMorningBriefingJob } from "./jobs/morningBriefing";
import { scheduleBriefingE2EOneShot } from "./jobs/scheduleMorningBriefing";
import { pdfExportCircuit } from "./lib/circuitBreaker";
import { getDetailedHealth, getPublicHealthSnapshot, withHealthProbeTimeout } from "./lib/healthCheck";
import { redisConnection } from "./lib/redis";
import { buildInstagramBrowserOAuthUrl } from "./lib/instagramBrowserOAuth";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { briefingQueue, isBriefingNineAmDispatchMode } from "./queues/briefingQueue";
import {
  PDF_QUEUE_CAP_ACTIVE,
  PDF_QUEUE_CAP_WAITING,
  PDF_QUEUE_WARN_ACTIVE,
  PDF_QUEUE_WARN_WAITING,
  pdfQueue
} from "./queues/pdfQueue";
import { authenticate } from "./middleware/authenticate";
import { errorHandler } from "./middleware/errorHandler";
import { globalApiLimiter, webhookLimiter } from "./middleware/rateLimiter";
import { aiRouter } from "./routes/ai";
import { aiInsightsRouter } from "./routes/aiInsights";
import { analyticsRouter } from "./routes/analytics";
import { auditLogsRouter } from "./routes/auditLogs";
import { authRouter } from "./routes/auth";
import { billingRouter } from "./routes/billing";
import { billingWebhookRouter } from "./routes/billingWebhook";
import { briefingRouter } from "./routes/briefing";
import { agencyRouter } from "./routes/agency";
import { clientsRouter } from "./routes/clients";
import { healthRouter } from "./routes/health";
import { insightsRouter } from "./routes/insights";
import { instagramRouter } from "./routes/instagram";
import { leadsRouter } from "./routes/leads";
import { messageRouter } from "./routes/message";
import { oauthCallbacksRouter } from "./routes/oauthCallbacks";
import { postsRouter } from "./routes/posts";
import { pulseGovPreviewRouter } from "./routes/govPreview";
import { pulseRouter } from "./routes/pulse";
import { reportsRouter } from "./routes/reports";
import { socialAccountsRouter } from "./routes/socialAccounts";
import { executeRouter } from "./routes/execute";
import { voicePostRouter } from "./routes/voicePost";
import { instagramWebhookRouter } from "./routes/webhook";
import { webhookRouter } from "./routes/webhooks";
import { waWebhookRouter } from "./whatsapp/webhook.router";
import { adminSystemRouter } from "./routes/adminSystem";
import { briefingPublicRouter } from "./routes/briefingPublic";
import { attachSseRoute } from "./routes/sse";

/** Always allowed in addition to CORS_ORIGIN (when not *). */
const DEFAULT_CORS_ORIGINS = [
  "https://social-media-controller.vercel.app",
  "https://social-media-controller.onrender.com",
  "http://localhost:3000",
  "http://localhost:3002"
] as const;

function corsOrigin(): boolean | string[] {
  // Production forbids * in env schema — keep runtime guard for defense in depth.
  if (env.CORS_ORIGIN === "*") return true;
  const list = env.CORS_ORIGIN.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const merged = [...new Set([...list, ...DEFAULT_CORS_ORIGINS])];
  return merged.length ? merged : [...DEFAULT_CORS_ORIGINS];
}

/** Tight Helmet defaults for JSON API — explicit CSP / Referrer-Policy / HSTS in prod. */
function securityHelmet() {
  return helmet({
    referrerPolicy: { policy: "no-referrer" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
        frameAncestors: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false,
    strictTransportSecurity:
      env.NODE_ENV === "production"
        ? { maxAge: 31_536_000, includeSubDomains: true }
        : false
  });
}

function buildApiRouter(): express.Router {
  const api = express.Router();
  api.get("/", (_req, res) => {
    res.type("text/plain").send("PulseOS Quadrapilot Ready 🚀");
  });
  api.use("/health", healthRouter);
  api.use("/auth", authRouter);
  api.use("/instagram", instagramRouter);
  api.use("/ai", aiRouter);
  api.use("/billing", billingRouter);
  api.use("/agency", agencyRouter);
  api.use("/clients", clientsRouter);
  api.use("/leads", leadsRouter);
  api.use("/posts", postsRouter);
  api.use("/reports", reportsRouter);
  api.use("/audit-logs", auditLogsRouter);
  api.use("/social-accounts", socialAccountsRouter);
  api.use("/webhooks", webhookRouter);
  api.use("/execute", executeRouter);
  api.use("/message", messageRouter);
  /** Public gov metrics: `GET /api/gov-preview` (alias of `/api/pulse/gov-preview` for older clients). */
  
  return api;
}

export function createApp() {
  try {
    if (env.SENTRY_DSN) {
      Sentry.init({
        dsn: env.SENTRY_DSN,
        environment: env.NODE_ENV,
        tracesSampleRate: 0.2
      });
    }
  } catch (err) {
    logger.warn("Sentry init failed", {
      message: err instanceof Error ? err.message : String(err)
    });
  }

  const app = express();

  // One trusted hop (e.g. Render, Railway) so req.ip and rate limits use the real client.
  if (env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  app.use(securityHelmet());
  app.use(
    cors({
      origin: corsOrigin(),
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      exposedHeaders: ["Location"]
    })
  );
  app.use(cookieParser());
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
  app.use(
    "/api/webhook/instagram",
    express.raw({ type: "application/json", limit: "1mb" }),
    instagramWebhookRouter
  );
  app.get("/whatsapp/webhook", (req, res) => {
    const mode = typeof req.query["hub.mode"] === "string" ? req.query["hub.mode"] : "";
    const token = typeof req.query["hub.verify_token"] === "string" ? req.query["hub.verify_token"] : "";
    const challenge = typeof req.query["hub.challenge"] === "string" ? req.query["hub.challenge"] : "";
    const expected = process.env.WEBHOOK_VERIFY_TOKEN?.trim() ?? "";

    if (mode === "subscribe" && token === expected) {
      res.status(200).type("text/plain").send(challenge);
      return;
    }
    res.status(403).type("text/plain").send("Forbidden");
  });
  app.post(
    "/whatsapp/webhook",
    express.raw({ type: "*/*", limit: "5mb" }),
    webhookLimiter,
    waWebhookRouter
  );
  app.use("/api/billing", billingWebhookRouter);
  app.use(
    express.json({
      limit: "1mb",
      verify: (req, _res, buf) => {
        if (buf.length > 0) {
          (req as express.Request).rawBody = Buffer.from(buf);
        }
      }
    })
  );
  app.use(globalApiLimiter);

  attachSseRoute(app);
  app.use("/api/briefing/public", briefingPublicRouter);

  app.get("/", (_req, res) => {
    res.json({
      message: "Instagram Growth Copilot API",
      version: "1.0.0",
      status: "running"
    });
  });

  app.use(
    morgan("combined", {
      stream: {
        write: (message) => logger.info(message.trim())
      }
    })
  );

  app.get("/health", async (_req, res) => {
    try {
      const body = await withHealthProbeTimeout(getDetailedHealth());
      res.status(body.database === "error" ? 503 : 200).json(body);
    } catch (err) {
      logger.warn("/health failed", {
        message: err instanceof Error ? err.message : String(err)
      });
      res.status(503).json({ server: "error", database: "error", message: "Health check failed" });
    }
  });

  /** Liveness: instant 200 without DB. Optional: ?deps=1 includes dependency checks. */
  app.get("/api/health", async (req, res) => {
    try {
      const payload: Record<string, unknown> = {
        status: "ok",
        timestamp: new Date().toISOString(),
        environment: env.NODE_ENV === "production" ? "production" : env.NODE_ENV
      };
      const wantDeps = req.query.deps === "1" || req.query.deps === "true";
      if (!wantDeps) {
        res.json(payload);
        return;
      }
      const snapshot = await withHealthProbeTimeout(getPublicHealthSnapshot());
      payload.status = snapshot.status;
      payload.timestamp = snapshot.timestamp;
      payload.components = snapshot.components;
      res.status(200).json(payload);
    } catch (err) {
      logger.warn("/api/health failed", {
        message: err instanceof Error ? err.message : String(err)
      });
      res.status(200).json({
        status: "degraded",
        timestamp: new Date().toISOString(),
        message: "Health check dependency error."
      });
    }
  });

  /** DB connectivity probe (Prisma). Use after fixing DATABASE_URL on Render. */
  app.get("/api/health/db", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({
        status: "ok",
        database: "connected",
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      logger.warn("/api/health/db failed", { message: detail });
      res.status(503).json({
        status: "error",
        ...(env.NODE_ENV === "production" ? {} : { detail })
      });
    }
  });

  /**
   * Load-shedding signal for monitors: PDF circuit state + queue depth (no secrets).
   * Use with alerts: ok=false or circuit.state=OPEN or queue past PDF_QUEUE_CAP_*.
   */
  app.get("/api/health/degraded", async (_req, res) => {
    try {
      const circuit = pdfExportCircuit.snapshot();
      let pdfCounts: { waiting: number; active: number; failed: number; delayed?: number } | null = null;
      if (pdfQueue) {
        const raw = await withHealthProbeTimeout(pdfQueue.getJobCounts());
        pdfCounts = {
          waiting: raw.waiting,
          active: raw.active,
          failed: raw.failed,
          delayed: raw.delayed
        };
      }
      const queueHot =
        pdfCounts != null &&
        (pdfCounts.waiting > PDF_QUEUE_WARN_WAITING || pdfCounts.active > PDF_QUEUE_WARN_ACTIVE);
      const ok = circuit.state !== "OPEN" && !queueHot;
      res.status(200).json({
        ok,
        timestamp: new Date().toISOString(),
        circuit,
        pdfQueue: pdfCounts
      });
    } catch (err) {
      logger.warn("/api/health/degraded partial failure", {
        message: err instanceof Error ? err.message : String(err)
      });
      res.status(200).json({
        ok: false,
        timestamp: new Date().toISOString(),
        circuit: pdfExportCircuit.snapshot(),
        pdfQueue: null,
        message: "degraded probe incomplete"
      });
    }
  });

  /**
   * Load balancer / synthetic probe: **503** when PDF path is unsafe to send traffic.
   * Stricter than `/api/health/degraded` (which stays 200 for observability).
   */
  app.get("/api/health/critical", async (_req, res) => {
    const circuit = pdfExportCircuit.snapshot();
    if (circuit.state === "OPEN") {
      res.status(503).json({
        ok: false,
        reason: "PDF_CIRCUIT_OPEN",
        timestamp: new Date().toISOString()
      });
      return;
    }
    if (pdfQueue) {
      try {
        const raw = await withHealthProbeTimeout(pdfQueue.getJobCounts());
        if (raw.waiting > PDF_QUEUE_CAP_WAITING || raw.active > PDF_QUEUE_CAP_ACTIVE) {
          res.status(503).json({
            ok: false,
            reason: "PDF_QUEUE_BACKLOG",
            waiting: raw.waiting,
            active: raw.active,
            timestamp: new Date().toISOString()
          });
          return;
        }
      } catch (err) {
        logger.warn("/api/health/critical queue probe failed", {
          message: err instanceof Error ? err.message : String(err)
        });
        res.status(503).json({
          ok: false,
          reason: "PDF_QUEUE_PROBE_FAILED",
          timestamp: new Date().toISOString()
        });
        return;
      }
    }
    res.status(200).json({ ok: true, timestamp: new Date().toISOString() });
  });

  /**
   * Operator snapshot: memory, circuit, PDF queue counts, Redis ping.
   * Disabled unless `METRICS_SECRET` is set; requires `x-pulse-metrics-key` header.
   */
  app.get("/api/metrics", async (req, res) => {
    if (!env.METRICS_SECRET || req.get("x-pulse-metrics-key") !== env.METRICS_SECRET) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    try {
      const circuit = pdfExportCircuit.snapshot();
      let pdfCounts: {
        waiting: number;
        active: number;
        failed: number;
        delayed?: number;
        completed: number;
      } | null = null;
      let failureRatio: number | null = null;
      if (pdfQueue) {
        const raw = await withHealthProbeTimeout(pdfQueue.getJobCounts());
        const completed = raw.completed ?? 0;
        const failed = raw.failed;
        const denom = completed + failed;
        failureRatio = denom > 0 ? Math.round((failed / denom) * 1000) / 1000 : null;
        pdfCounts = {
          waiting: raw.waiting,
          active: raw.active,
          failed: raw.failed,
          delayed: raw.delayed,
          completed
        };
      }
      let redisPing: "ok" | "skipped" | "error" = "skipped";
      if (redisConnection) {
        try {
          const pong = await withHealthProbeTimeout(redisConnection.ping());
          redisPing = pong === "PONG" ? "ok" : "error";
        } catch {
          redisPing = "error";
        }
      }
      res.status(200).json({
        timestamp: new Date().toISOString(),
        memory: process.memoryUsage(),
        circuit,
        pdfQueue: pdfCounts,
        failure_ratio: failureRatio,
        redis: { ping: redisPing }
      });
    } catch (err) {
      logger.warn("/api/metrics failed", {
        message: err instanceof Error ? err.message : String(err)
      });
      res.status(503).json({ error: "metrics_unavailable" });
    }
  });

  /** Alias: same OAuth redirect as `GET /api/auth/instagram` (Meta must allow frontend redirect URI). */
  app.get("/auth/instagram", authenticate, async (req, res) => {
    try {
      const auth = req.auth!;
      const built = await buildInstagramBrowserOAuthUrl({
        role: auth.role,
        userId: auth.userId,
        clientIdFromToken: auth.clientId,
        query: req.query as Record<string, unknown>
      });
      if (!built.ok) {
        res.status(built.status).send(built.message);
        return;
      }
      res.redirect(302, built.url);
    } catch (err) {
      logger.warn("/auth/instagram failed", {
        message: err instanceof Error ? err.message : String(err)
      });
      res.status(500).send("Instagram OAuth redirect failed");
    }
  });

  app.use("/api/oauth", oauthCallbacksRouter);
  app.use("/api", buildApiRouter());
  app.use("/api/analytics", analyticsRouter);
  app.use("/api/ai/insights", aiInsightsRouter);
  app.use("/api/insights", insightsRouter);
  app.use("/api/briefing", briefingRouter);
  app.use("/api", pulseGovPreviewRouter);
  app.use("/api/pulse", pulseGovPreviewRouter);
  app.use("/api/pulse", pulseRouter);
  app.use("/api/voice", voicePostRouter);
  app.use("/api/admin", adminSystemRouter);

  if (env.NODE_ENV === "production") {
    if (briefingQueue) {
      if (isBriefingNineAmDispatchMode()) {
        logger.info("[PulseOS] Morning briefing configured", {
          mode: "bullmq_whatsapp_briefing",
          schedule: "09:00 Asia/Kolkata",
          cron: "disabled"
        });
      } else {
        logger.info("[PulseOS] Morning briefing configured", {
          mode: "bullmq_dispatch_hour",
          schedule: "hourly :00 Asia/Kolkata",
          cron: "disabled"
        });
      }
    } else {
      startMorningBriefingJob();
      logger.info("[PulseOS] Morning briefing configured", {
        mode: "node_cron_hourly",
        timezone: "Asia/Kolkata",
        note: "per-client briefingHourIst"
      });
    }

    if (!redisConnection) {
      cron.schedule(
        "0 2 * * 0",
        () => {
          void runWeeklyDatabaseCleanup().catch((e) =>
            logger.error("Weekly database cleanup failed", {
              message: e instanceof Error ? e.message : String(e)
            })
          );
        },
        { timezone: "Asia/Kolkata" }
      );
      logger.info("Weekly DB cleanup scheduled (no Redis): Sundays 02:00 IST");
    }
  }

  if (env.SENTRY_DSN) {
    try {
      setupExpressErrorHandler(app);
    } catch (err) {
      logger.warn("Sentry Express error handler failed", {
        message: err instanceof Error ? err.message : String(err)
      });
    }
  }
  app.use(errorHandler);

  scheduleBriefingE2EOneShot();

  return app;
}
