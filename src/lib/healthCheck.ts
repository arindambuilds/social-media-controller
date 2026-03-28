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

export async function getDetailedHealth(): Promise<HealthStatus> {
  const timestamp = new Date().toISOString();
  let database: "ok" | "error" = "ok";
  let redis: "ok" | "error" = "ok";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "error";
  }

  if (redisConnection) {
    try {
      const pong = await redisConnection.ping();
      if (pong !== "PONG") redis = "error";
    } catch {
      redis = "error";
    }
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
