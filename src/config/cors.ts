import type { CorsOptions } from "cors";
import { env } from "./env";

/** Always allowed in addition to CORS_ORIGIN (when not *). */
const DEFAULT_CORS_ORIGINS = [
  "https://social-media-controller.vercel.app",
  "https://social-media-controller.onrender.com",
  "http://localhost:3000",
  "http://localhost:3002"
] as const;

export function corsOrigin(): boolean | string[] {
  if (env.CORS_ORIGIN === "*") return true;
  const list = env.CORS_ORIGIN.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const merged = [...new Set([...list, ...DEFAULT_CORS_ORIGINS])];
  return merged.length ? merged : [...DEFAULT_CORS_ORIGINS];
}

export const corsOptions: CorsOptions = {
  origin: corsOrigin(),
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["Location"]
};
