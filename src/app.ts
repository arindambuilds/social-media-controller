import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { getDetailedHealth } from "./lib/healthCheck";
import { logger } from "./lib/logger";
import { authenticate } from "./middleware/authenticate";
import { buildInstagramBrowserOAuthUrl } from "./lib/instagramBrowserOAuth";
import { setupExpressErrorHandler } from "@sentry/node";
import { apiRouter } from "./routes";
import { analyticsRouter } from "./routes/analytics";
import { aiInsightsRouter } from "./routes/aiInsights";
import { insightsRouter } from "./routes/insights";
import { oauthCallbacksRouter } from "./routes/oauthCallbacks";
import { errorHandler } from "./middleware/errorHandler";

function corsOrigin(): boolean | string[] {
  if (env.CORS_ORIGIN === "*") return true;
  const list = env.CORS_ORIGIN.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : true;
}

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: corsOrigin(), credentials: true }));
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
    const body = await getDetailedHealth();
    res.status(body.database === "error" ? 503 : 200).json(body);
  });

  /** Alias: same OAuth redirect as `GET /api/auth/instagram` (Meta must allow frontend redirect URI). */
  app.get("/auth/instagram", authenticate, async (req, res) => {
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
  });

  app.use("/api/oauth", oauthCallbacksRouter);
  app.use("/api", apiRouter);
  app.use("/api/analytics", analyticsRouter);
  app.use("/api/ai/insights", aiInsightsRouter);
  app.use("/api/insights", insightsRouter);

  if (env.SENTRY_DSN) {
    setupExpressErrorHandler(app);
  }
  app.use(errorHandler);

  return app;
}
