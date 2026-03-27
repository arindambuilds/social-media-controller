import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("1d"),
  ENCRYPTION_KEY: z.string().min(32),
  SENTRY_DSN: z.string().optional().default(""),
  APP_BASE_URL: z.string().url(),
  FACEBOOK_APP_ID: z.string().optional().default(""),
  FACEBOOK_APP_SECRET: z.string().optional().default("")
});

export const env = envSchema.parse(process.env);
