import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { logger } from "../lib/logger";

/** Repo root `.env` — independent of shell cwd (works when `npm run dev` is invoked from a parent directory). */
const envPath = path.resolve(__dirname, "../../.env");

dotenv.config({ path: envPath, override: false });

const envFileExists = fs.existsSync(envPath);
const hasCoreEnvFromProcess =
  Boolean(process.env.DATABASE_URL?.trim()) &&
  Boolean(process.env.JWT_SECRET?.trim()) &&
  Boolean(process.env.JWT_REFRESH_SECRET?.trim());

if (!envFileExists && !hasCoreEnvFromProcess && process.env.NODE_ENV !== "production") {
  logger.error("[env] FATAL: missing .env and core env vars", {
    envPath,
    required: ["DATABASE_URL", "JWT_SECRET", "JWT_REFRESH_SECRET"]
  });
  process.exit(1);
}

/** Public API URL when `APP_BASE_URL` is unset (e.g. Render without the variable). */
const DEFAULT_APP_BASE_URL = "https://social-media-controller.onrender.com";

const processEnv = { ...process.env };
if (!processEnv.CORS_ORIGIN?.trim() && processEnv.CORS_ORIGINS?.trim()) {
  processEnv.CORS_ORIGIN = processEnv.CORS_ORIGINS;
}

/** Parse compact jwt-style durations (15m, 7d, 3600s) to seconds — used only for policy checks. */
function parseDurationToSeconds(value: string): number {
  const s = value.trim();
  const m = /^(\d+)\s*(ms|s|m|h|d)$/i.exec(s);
  if (!m) return Number.NaN;
  const n = Number(m[1]);
  const u = m[2].toLowerCase();
  const mult =
    u === "ms" ? 0.001 : u === "s" ? 1 : u === "m" ? 60 : u === "h" ? 3600 : 86400;
  return n * mult;
}

const ACCESS_TOKEN_MAX_SECONDS_PROD = 15 * 60;
const REFRESH_TOKEN_MAX_SECONDS_PROD = 7 * 24 * 3600;

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().optional(),
    DATABASE_URL: z.string().min(1),
    /**
     * Direct Postgres URL for Prisma migrations / direct access (usually port 5432).
     * For Supabase + Render, DATABASE_URL should be the transaction pooler (:6543) and DIRECT_URL stays direct (:5432).
     * Local dev may set DIRECT_URL equal to DATABASE_URL.
     */
    DIRECT_URL: z.string().min(1).optional(),
    JWT_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    REDIS_URL: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    INSTAGRAM_CLIENT_ID: z.string().optional(),
    INSTAGRAM_CLIENT_SECRET: z.string().optional(),
    FACEBOOK_APP_ID: z.string().optional(),
    FACEBOOK_APP_SECRET: z.string().optional(),
    SENTRY_DSN: z.string().optional(),
    APP_BASE_URL: z.string().url().optional(),
    ENCRYPTION_KEY: z.string().optional(),
    ENCRYPTION_KEY_PREV: z.string().optional(),
    INGESTION_MODE: z.enum(["instagram", "mock"]).default("mock"),
    /** Access JWT lifetime — default 15m limits blast radius if stolen. */
    JWT_EXPIRES_IN: z.string().default("15m"),
    /** Refresh JWT — cap 7d in production via superRefine. */
    JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
    META_APP_ID: z.string().optional().default(""),
    META_APP_SECRET: z.string().optional().default(""),
    OAUTH_REDIRECT_BASE_URL: z.string().url().optional().default("http://localhost:4000"),
    LINKEDIN_CLIENT_ID: z.string().optional().default(""),
    LINKEDIN_CLIENT_SECRET: z.string().optional().default(""),
    INSTAGRAM_APP_ID: z.string().optional().default(""),
    INSTAGRAM_APP_SECRET: z.string().optional().default(""),
    INSTAGRAM_REDIRECT_URI: z
      .string()
      .url()
      .optional()
      .default("http://localhost:4000/api/auth/oauth/instagram/callback"),
    INSTAGRAM_FRONTEND_REDIRECT_URI: z
      .string()
      .url()
      .optional()
      .default("http://localhost:3000/onboarding/callback"),
    OPENAI_MODEL: z.string().optional().default("gpt-5"),
    WEBHOOK_SIGNING_SECRET: z.string().optional().default(""),
    /** Meta Instagram / Messenger webhook verification (GET hub.verify_token). */
    WEBHOOK_VERIFY_TOKEN: z.string().optional().default(""),
    /** WhatsApp Cloud API (ingress + Graph) — optional; used when Twilio outbound is not the primary path. */
    WA_PHONE_NUMBER_ID: z.string().optional().default(""),
    /** Meta system user / permanent token for Graph sends. */
    WA_ACCESS_TOKEN: z.string().optional().default(""),
    /** Legacy alias for {@link WA_ACCESS_TOKEN} (Render/docs). */
    WA_TOKEN: z.string().optional().default(""),
    /** Graph version segment, e.g. `v19.0` (no leading slash). */
    WA_API_VERSION: z.string().optional().default("v19.0"),
    /** Optional template name when freeform hits 131047 (future template resend). */
    WA_FALLBACK_TEMPLATE_NAME: z.string().optional().default(""),
    WA_APP_SECRET: z.string().optional().default(""),
    /** When `false`, API process skips embedding Meta outbound worker (use `npm run worker:wa:outbound`). */
    START_WA_OUTBOUND_WORKER_IN_API: z.string().optional().default("true"),
    /**
     * Optional dedupe window (seconds) for WhatsApp webhook `message.id` via Redis SET NX.
     * `0` = off (default). Set e.g. `86400` to ignore exact duplicate Meta retries within 24h.
     */
    WA_WEBHOOK_MSG_DEDUPE_TTL_SEC: z.coerce.number().int().min(0).optional().default(0),
    /** When true, DM sends are logged only (no Graph API). */
    INSTAGRAM_MOCK_MODE: z.preprocess((val) => {
      if (val === undefined || val === null || val === "") return undefined;
      if (val === false || val === "false" || val === "0" || val === 0) return false;
      if (val === true || val === "true" || val === "1" || val === 1) return true;
      return undefined;
    }, z.boolean().optional().default(true)),
    /** Comma-separated origins, or * for dev-only (refused in production). */
    CORS_ORIGIN: z.string().optional().default("*"),
    /**
     * When true: issue httpOnly JWT cookies on login/signup/refresh/register, accept them in
     * `authenticate` and refresh, and expose POST /api/auth/logout to clear them. JSON tokens are
     * still returned for API clients; the dashboard should use `credentials: "include"` (already default).
     */
    AUTH_HTTPONLY_COOKIES: z
      .string()
      .default("true")
      .transform((val) => {
        const normalized = val.trim().toLowerCase();
        return normalized !== "false" && normalized !== "0";
      }),
    /** Morning briefing (Claude + Twilio + SMTP) — all optional; feature degrades gracefully. */
    ANTHROPIC_API_KEY: z.string().optional(),
    ANTHROPIC_BRIEFING_MODEL: z.string().optional(),
    /** Intent + caption steps for voice-to-post (defaults to Sonnet in code). */
    ANTHROPIC_VOICE_MODEL: z.string().optional(),
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    TWILIO_WHATSAPP_FROM: z.string().optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.string().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    /** Optional From header; defaults to SMTP_USER (works for Gmail; use verified sender for SendGrid). */
    SMTP_FROM: z.string().optional(),
    /** Stripe billing */
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    /**
     * Stripe Price ID for **PulseOS Pioneer Plan** — INR 600/month recurring (create in Dashboard).
     * Used when `POST /api/billing/checkout` has `planId: "pioneer"` (server ignores client `priceId` for that tier).
     */
    STRIPE_PRICE_PIONEER600_INR: z.string().optional(),
    DASHBOARD_URL: z.string().url().optional().default("http://localhost:3000"),
    /**
     * When set, `GET /api/metrics` is enabled and requires header `x-pulse-metrics-key: <value>`.
     * Omit in production unless you need operator snapshots (treat like a password).
     */
    METRICS_SECRET: z.string().min(24).optional(),
    /** e.g. `http://gotenberg:3000` — when set, PDF worker uses Gotenberg instead of Puppeteer. */
    GOTENBERG_URL: z.string().url().optional(),
    /** Set to `disabled` to skip HTML→PDF locally (reports return 503 until re-enabled). */
    PDF_GENERATION: z.enum(["disabled"]).optional(),
    /**
     * `hourly` (default): BullMQ `dispatch-hour` every :00 IST.
     * `nine_am_ist`: only `whatsapp-briefing` queue at 09:00 IST (requires `startWhatsAppBriefingWorker` in API).
     */
    BRIEFING_DISPATCH_MODE: z.string().optional()
  })
  .superRefine((data, ctx) => {
    // Reject wildcard CORS in production — prevents credentialed abuse from arbitrary sites.
    if (data.NODE_ENV === "production" && data.CORS_ORIGIN.trim() === "*") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "CORS_ORIGIN cannot be * in production. Set an explicit comma-separated allowlist (e.g. https://your-app.vercel.app).",
        path: ["CORS_ORIGIN"]
      });
    }
    if (data.NODE_ENV !== "production") return;

    const accessSec = parseDurationToSeconds(data.JWT_EXPIRES_IN);
    if (!Number.isFinite(accessSec) || accessSec > ACCESS_TOKEN_MAX_SECONDS_PROD) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `JWT_EXPIRES_IN must parse to <= ${ACCESS_TOKEN_MAX_SECONDS_PROD}s in production (e.g. 15m).`,
        path: ["JWT_EXPIRES_IN"]
      });
    }

    const refreshSec = parseDurationToSeconds(data.JWT_REFRESH_EXPIRES_IN);
    if (!Number.isFinite(refreshSec) || refreshSec > REFRESH_TOKEN_MAX_SECONDS_PROD) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `JWT_REFRESH_EXPIRES_IN must parse to <= ${REFRESH_TOKEN_MAX_SECONDS_PROD}s in production (max 7d).`,
        path: ["JWT_REFRESH_EXPIRES_IN"]
      });
    }

    const db = data.DATABASE_URL.toLowerCase();
    const direct = (data.DIRECT_URL ?? data.DATABASE_URL).toLowerCase();
    // TLS: explicit sslmode, or Supabase pooler / pgbouncer (encrypted by platform defaults).
    const hasExplicitTls = db.includes("sslmode=require") || db.includes("ssl=true");
    const supabasePooled =
      db.includes("pooler.supabase.com") || db.includes("pgbouncer=true");
    if (!hasExplicitTls && !supabasePooled) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "DATABASE_URL should use TLS in production (e.g. sslmode=require) or Supabase Transaction pooler (?pgbouncer=true on pooler host).",
        path: ["DATABASE_URL"]
      });
    }

    if (db.includes(":5432")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "DATABASE_URL should be the runtime connection. In production with Supabase/Render, use the transaction pooler on :6543, not the direct :5432 connection.",
        path: ["DATABASE_URL"]
      });
    }

    if (supabasePooled && direct.includes(":6543")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "DIRECT_URL should stay on the direct Postgres connection (typically :5432) when DATABASE_URL uses the pooler.",
        path: ["DIRECT_URL"]
      });
    }
  });

let parsed: z.infer<typeof envSchema>;
try {
  parsed = envSchema.parse(processEnv);
} catch (e) {
  if (e instanceof z.ZodError) {
    logger.error("Invalid environment configuration", { fieldErrors: e.flatten().fieldErrors });
  }
  throw e;
}

function resolveAppBaseUrl(): string {
  if (parsed.APP_BASE_URL) return parsed.APP_BASE_URL;
  const render = process.env.RENDER_EXTERNAL_URL?.trim();
  if (render) return render.replace(/\/$/, "");
  const railway = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railway) return `https://${railway}`;
  return DEFAULT_APP_BASE_URL;
}

// Prisma schema requires DIRECT_URL; default to DATABASE_URL only for local single-host Postgres setups.
if (!process.env.DIRECT_URL?.trim()) {
  process.env.DIRECT_URL = parsed.DATABASE_URL;
}

export const env = {
  ...parsed,
  DIRECT_URL: process.env.DIRECT_URL!,
  APP_BASE_URL: resolveAppBaseUrl(),
  METRICS_SECRET: parsed.METRICS_SECRET?.trim() || undefined,
  /** Resolved Meta Graph token: `WA_ACCESS_TOKEN` wins, then `WA_TOKEN`. */
  WA_GRAPH_ACCESS_TOKEN: (parsed.WA_ACCESS_TOKEN?.trim() || parsed.WA_TOKEN?.trim() || "").trim()
};

export const emailConfig = {
  provider: (process.env.EMAIL_PROVIDER?.trim() || "postmark") as "postmark" | "ses",
  postmarkToken: process.env.POSTMARK_API_TOKEN?.trim() || undefined,
  /** Set in production; default keeps local/test boot without failing env parse. */
  fromAddress: process.env.EMAIL_FROM_ADDRESS?.trim() || "noreply@pulseos.local",
  fromName: process.env.EMAIL_FROM_NAME?.trim() || "PulseOS",
  replyTo: process.env.EMAIL_REPLY_TO?.trim() || undefined,
  concurrency: Number.parseInt(process.env.EMAIL_QUEUE_CONCURRENCY ?? "5", 10),
  logsEnabled: process.env.EMAIL_LOGS_ENABLED !== "false",
  devIntercept:
    env.NODE_ENV !== "production" ? process.env.EMAIL_DEV_INTERCEPT?.trim() || undefined : undefined,
  rateLimitPerHour: Number.parseInt(process.env.EMAIL_RATE_LIMIT_PER_HOUR ?? "5", 10),
  rateLimitPerDay: Number.parseInt(process.env.EMAIL_RATE_LIMIT_PER_DAY ?? "20", 10),
  dedupeTtlSeconds: Number.parseInt(process.env.EMAIL_DEDUPE_TTL_SECONDS ?? "3600", 10),
  retentionDays: Number.parseInt(process.env.EMAIL_LOG_RETENTION_DAYS ?? "90", 10),
  dlqAlertThreshold: Number.parseInt(process.env.EMAIL_DLQ_ALERT_THRESHOLD ?? "5", 10),
  defaultAlertEmail: process.env.DEFAULT_ALERT_EMAIL?.trim() || "admin@pulseos.in",
  postmarkWebhookSecret: process.env.POSTMARK_WEBHOOK_SECRET?.trim() || undefined
} as const;
