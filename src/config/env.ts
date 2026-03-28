import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

/** Public API URL when `APP_BASE_URL` is unset (e.g. Render without the variable). */
const DEFAULT_APP_BASE_URL = "https://social-media-controller.onrender.com";

const processEnv = { ...process.env };
if (!processEnv.CORS_ORIGIN?.trim() && processEnv.CORS_ORIGINS?.trim()) {
  processEnv.CORS_ORIGIN = processEnv.CORS_ORIGINS;
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().optional(),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  REDIS_URL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  INSTAGRAM_CLIENT_ID: z.string().optional(),
  INSTAGRAM_CLIENT_SECRET: z.string().optional(),
  FACEBOOK_APP_ID: z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  /** If unset, derived below so Zod does not crash deploys. */
  APP_BASE_URL: z.string().url().optional(),
  ENCRYPTION_KEY: z.string().optional(),
  INGESTION_MODE: z.enum(["instagram", "mock"]).default("mock"),
  JWT_EXPIRES_IN: z.string().default("1d"),
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
  CORS_ORIGIN: z.string().optional().default("*")
});

const parsed = envSchema.parse(processEnv);

function resolveAppBaseUrl(): string {
  if (parsed.APP_BASE_URL) return parsed.APP_BASE_URL;
  const render = process.env.RENDER_EXTERNAL_URL?.trim();
  if (render) return render.replace(/\/$/, "");
  const railway = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railway) return `https://${railway}`;
  return DEFAULT_APP_BASE_URL;
}

export const env = {
  ...parsed,
  APP_BASE_URL: resolveAppBaseUrl()
};
