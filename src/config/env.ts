import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

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
    /** Comma-separated origins, or * for dev-only (refused in production). */
    CORS_ORIGIN: z.string().optional().default("*"),
    /**
     * When true: issue httpOnly JWT cookies on login/signup/refresh/register, accept them in
     * `authenticate` and refresh, and expose POST /api/auth/logout to clear them. JSON tokens are
     * still returned for API clients; the dashboard should use `credentials: "include"` (already default).
     */
    AUTH_HTTPONLY_COOKIES: z
      .preprocess((val) => val === true || val === "true" || val === "1", z.boolean())
      .default(false)
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
    console.error("Invalid environment configuration:", e.flatten().fieldErrors);
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
  APP_BASE_URL: resolveAppBaseUrl()
};
