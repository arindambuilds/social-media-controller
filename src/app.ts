import * as Sentry from "@sentry/node";
import { setupExpressErrorHandler } from "@sentry/node";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import cron from "node-cron";
import { runWeeklyDatabaseCleanup } from "./jobs/databaseCleanup";
import { startMorningBriefingJob } from "./jobs/morningBriefing";
import { getDetailedHealth, getPublicHealthSnapshot } from "./lib/healthCheck";
import { redisConnection } from "./lib/redis";
import { buildInstagramBrowserOAuthUrl } from "./lib/instagramBrowserOAuth";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { authenticate } from "./middleware/authenticate";
import { errorHandler } from "./middleware/errorHandler";
import { globalApiLimiter } from "./middleware/rateLimiter";
import { aiRouter } from "./routes/ai";
import { aiInsightsRouter } from "./routes/aiInsights";
import { analyticsRouter } from "./routes/analytics";
import { auditLogsRouter } from "./routes/auditLogs";
import { authRouter } from "./routes/auth";
import { billingRouter } from "./routes/billing";
import { briefingRouter } from "./routes/briefing";
import { clientsRouter } from "./routes/clients";
import { healthRouter } from "./routes/health";
import { insightsRouter } from "./routes/insights";
import { instagramRouter } from "./routes/instagram";
import { leadsRouter } from "./routes/leads";
import { oauthCallbacksRouter } from "./routes/oauthCallbacks";
import { postsRouter } from "./routes/posts";
import { socialAccountsRouter } from "./routes/socialAccounts";
import { voicePostRouter } from "./routes/voicePost";
import { instagramWebhookRouter } from "./routes/webhook";
import { webhookRouter } from "./routes/webhooks";
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
  api.use("/health", healthRouter);
  api.use("/auth", authRouter);
  api.use("/instagram", instagramRouter);
  api.use("/ai", aiRouter);
  api.use("/billing", billingRouter);
  api.use("/clients", clientsRouter);
  api.use("/leads", leadsRouter);
  api.use("/posts", postsRouter);
  api.use("/audit-logs", auditLogsRouter);
  api.use("/social-accounts", socialAccountsRouter);
  api.use("/webhooks", webhookRouter);
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
  app.use(
    "/api/webhook/instagram",
    express.raw({ type: "application/json", limit: "1mb" }),
    instagramWebhookRouter
  );
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
      const body = await getDetailedHealth();
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
      const snapshot = await getPublicHealthSnapshot();
      payload.status = snapshot.status;
      payload.timestamp = snapshot.timestamp;
      payload.components = snapshot.components;
      const dbBad = snapshot.components.database?.status === "error";
      res.status(dbBad ? 503 : 200).json(payload);
    } catch (err) {
      logger.warn("/api/health failed", {
        message: err instanceof Error ? err.message : String(err)
      });
      res.status(503).json({
        status: "error",
        timestamp: new Date().toISOString(),
        message:
          env.NODE_ENV === "production"
            ? "Health check dependency error."
            : err instanceof Error
              ? err.message
              : String(err)
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
  app.use("/api/voice", voicePostRouter);
  app.use("/api/admin", adminSystemRouter);

  if (env.NODE_ENV === "production") {
    startMorningBriefingJob();
    console.log("[PulseOS] Morning briefing scheduler: every hour (Asia/Kolkata), per-client briefingHourIst");

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

  return app;
}
