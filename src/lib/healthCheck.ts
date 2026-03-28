import { env } from "../config/env";
import { prisma } from "./prisma";
import { redisConnection } from "./redis";

export type HealthStatus = {
  status: "ok" | "degraded";
  server: "ok";
  database: "ok" | "error";
  redis: "ok" | "error";
  timestamp: string;
  ingestionMode: "mock" | "instagram";
  instagramOAuthConfigured: boolean;
};

/** JSON shape for `GET /api/health` (Railway / public probes). */
export type PublicApiHealth = {
  status: "ok" | "degraded";
  database: "connected" | "disconnected";
  redis: "connected" | "disconnected";
  timestamp: string;
  environment: string;
};

export async function getDetailedHealth(): Promise<HealthStatus> {
  const timestamp = new Date().toISOString();
  let database: "ok" | "error" = "ok";
  let redis: "ok" | "error" = "ok";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "error";
  }

  try {
    const pong = await redisConnection.ping();
    if (pong !== "PONG") redis = "error";
  } catch {
    redis = "error";
  }

  const status = database === "ok" && redis === "ok" ? "ok" : "degraded";

  return {
    status,
    server: "ok",
    database,
    redis,
    timestamp,
    ingestionMode: env.INGESTION_MODE,
    instagramOAuthConfigured: Boolean(env.INSTAGRAM_APP_ID || env.FACEBOOK_APP_ID)
  };
}

export async function getPublicApiHealth(): Promise<PublicApiHealth> {
  const detailed = await getDetailedHealth();
  const database = detailed.database === "ok" ? "connected" : "disconnected";
  const redis = detailed.redis === "ok" ? "connected" : "disconnected";
  const status = database === "connected" && redis === "connected" ? "ok" : "degraded";
  return {
    status,
    database,
    redis,
    timestamp: detailed.timestamp,
    environment: env.NODE_ENV === "production" ? "production" : env.NODE_ENV
  };
}
