import * as Sentry from "@sentry/node";
import { setupExpressErrorHandler } from "@sentry/node";
import cors from "cors";
import express, { type Router } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { getDetailedHealth } from "./lib/healthCheck";
import { buildInstagramBrowserOAuthUrl } from "./lib/instagramBrowserOAuth";
import { logger } from "./lib/logger";
import { authenticate } from "./middleware/authenticate";
import { errorHandler } from "./middleware/errorHandler";

/** Always allowed in addition to CORS_ORIGIN (when not *). */
const DEFAULT_CORS_ORIGINS = [
  "https://social-media-controller.vercel.app",
  "https://social-media-controller-production.up.railway.app",
  "http://localhost:3000",
  "http://localhost:3002"
] as const;

function corsOrigin(): boolean | string[] {
  if (env.CORS_ORIGIN === "*") return true;
  const list = env.CORS_ORIGIN.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const merged = [...new Set([...list, ...DEFAULT_CORS_ORIGINS])];
  return merged.length ? merged : [...DEFAULT_CORS_ORIGINS];
}

/**
 * Load a route module with `require` so a broken submodule does not crash the whole process.
 * Paths are relative to compiled `dist/*.js` (same as `src/` layout).
 */
function tryUseRouter(
  parent: express.Application | express.Router,
  mountPath: string,
  relModule: string,
  exportName: string,
  label: string
): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(relModule) as Record<string, Router>;
    const router = mod[exportName];
    if (!router) {
      logger.warn(`[routes] ${label}: missing export ${exportName}`);
      return;
    }
    // Express 5 typings: Router sub-mount is valid at runtime
    (parent as express.Application).use(mountPath, router);
    logger.info(`[routes] mounted ${label}`);
  } catch (err) {
    logger.warn(`[routes] ${label} failed to load`, {
      message: err instanceof Error ? err.message : String(err)
    });
  }
}

function buildApiRouterSafely(): express.Router {
  const api = express.Router();
  const routes: Array<[string, string, string, string]> = [
    ["/health", "./routes/health", "healthRouter", "api/health (detailed)"],
    ["/auth", "./routes/auth", "authRouter", "auth"],
    ["/instagram", "./routes/instagram", "instagramRouter", "instagram"],
    ["/ai", "./routes/ai", "aiRouter", "ai"],
    ["/billing", "./routes/billing", "billingRouter", "billing"],
    ["/clients", "./routes/clients", "clientsRouter", "clients"],
    ["/leads", "./routes/leads", "leadsRouter", "leads"],
    ["/posts", "./routes/posts", "postsRouter", "posts"],
    ["/audit-logs", "./routes/auditLogs", "auditLogsRouter", "audit-logs"],
    ["/social-accounts", "./routes/socialAccounts", "socialAccountsRouter", "social-accounts"],
    ["/webhooks", "./routes/webhooks", "webhookRouter", "webhooks"]
  ];
  for (const [path, mod, exp, label] of routes) {
    tryUseRouter(api, path, mod, exp, label);
  }
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

  app.get("/", (_req, res) => {
    res.json({
      message: "Instagram Growth Copilot API",
      version: "1.0.0",
      status: "running"
    });
  });

  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigin(),
      credentials: true,
      exposedHeaders: ["Location"]
    })
  );
  app.use(express.json({ limit: "1mb" }));

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use("/api/auth", (req, res, next) => {
    if (req.method === "POST" && ["/login", "/signup", "/refresh"].includes(req.path)) {
      return authLimiter(req, res, next);
    }
    next();
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

  /** Liveness for Railway: instant 200, no DB/Redis wait. Optional: ?deps=1 includes dependency checks. */
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
      const detailed = await getDetailedHealth();
      payload.dependencies = {
        database: detailed.database === "ok" ? "connected" : "disconnected",
        redis: detailed.redis === "ok" ? "connected" : "disconnected"
      };
      res.json(payload);
    } catch (err) {
      logger.warn("/api/health failed", {
        message: err instanceof Error ? err.message : String(err)
      });
      res.status(503).json({
        status: "error",
        timestamp: new Date().toISOString(),
        message: err instanceof Error ? err.message : String(err)
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

  tryUseRouter(app, "/api/oauth", "./routes/oauthCallbacks", "oauthCallbacksRouter", "oauth callbacks");
  app.use("/api", buildApiRouterSafely());
  tryUseRouter(app, "/api/analytics", "./routes/analytics", "analyticsRouter", "analytics");
  tryUseRouter(app, "/api/ai/insights", "./routes/aiInsights", "aiInsightsRouter", "ai insights");
  tryUseRouter(app, "/api/insights", "./routes/insights", "insightsRouter", "insights");

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
