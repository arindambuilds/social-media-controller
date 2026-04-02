import { env } from "../config/env";
import { prisma } from "./prisma";
import { redisConnection } from "./redis";
import { logger } from "./logger";

const HEALTH_PROBE_MAX_MS = 5000;

/** Bounded wait so dependency probes cannot wedged the event loop behind slow Redis/Graph. */
export async function withHealthProbeTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("health_probe_timeout")), HEALTH_PROBE_MAX_MS);
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(t);
        reject(e);
      });
  });
}
import { briefingQueue } from "../queues/briefingQueue";
import { maintenanceQueue } from "../queues/maintenanceQueue";
import { pdfQueue } from "../queues/pdfQueue";

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

async function pingUrlReachable(url: string, init?: RequestInit): Promise<boolean> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal });
    return r.status > 0;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

async function bullmqSnapshot(): Promise<
  | { status: "skipped" }
  | { status: "error" }
  | {
      status: "ok";
      briefing: { waiting: number; active: number; failed: number; delayed: number };
      maintenance: { waiting: number; active: number; failed: number; delayed: number };
      pdf: { waiting: number; active: number; failed: number; delayed: number };
    }
> {
  if (!redisConnection || !briefingQueue || !maintenanceQueue || !pdfQueue) return { status: "skipped" };
  try {
    const [bc, mc, pc] = await Promise.all([
      briefingQueue.getJobCounts(),
      maintenanceQueue.getJobCounts(),
      pdfQueue.getJobCounts()
    ]);
    return {
      status: "ok",
      briefing: {
        waiting: bc.waiting,
        active: bc.active,
        failed: bc.failed,
        delayed: bc.delayed ?? 0
      },
      maintenance: {
        waiting: mc.waiting,
        active: mc.active,
        failed: mc.failed,
        delayed: mc.delayed ?? 0
      },
      pdf: {
        waiting: pc.waiting,
        active: pc.active,
        failed: pc.failed,
        delayed: pc.delayed ?? 0
      }
    };
  } catch {
    return { status: "error" };
  }
}

/** Dependency snapshot for `/api/health?deps=1` — no secrets. */
export async function getPublicHealthSnapshot(): Promise<{
  status: "ok" | "degraded";
  timestamp: string;
  components: Record<string, { status: "ok" | "error" | "skipped"; detail?: string }>;
}> {
  const timestamp = new Date().toISOString();
  const components: Record<string, { status: "ok" | "error" | "skipped"; detail?: string }> = {};

  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
    components.database = { status: "ok" };
  } catch {
    components.database = { status: "error", detail: "unavailable" };
    logger.warn(`[health] database check failed at ${timestamp}`);
  }

  if (redisConnection) {
    try {
      const pong = await redisConnection.ping();
      components.redis = { status: pong === "PONG" ? "ok" : "error" };
      if (components.redis.status === "error") {
        logger.warn(`[health] redis ping failed at ${timestamp}`);
      }
    } catch {
      components.redis = { status: "error" };
      logger.warn(`[health] redis error at ${timestamp}`);
    }
  } else {
    components.redis = { status: "skipped", detail: "no_redis_url" };
  }

  const igReachable = await pingUrlReachable("https://graph.facebook.com/v19.0/");
  components.instagram_api = { status: igReachable ? "ok" : "error" };
  if (!igReachable) logger.warn(`[health] Instagram Graph unreachable at ${timestamp}`);

  const claudeReachable = await pingUrlReachable("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "anthropic-version": "2023-06-01" },
    body: "{}"
  });
  components.claude_api = { status: claudeReachable ? "ok" : "error" };
  if (!claudeReachable) logger.warn(`[health] Claude API unreachable at ${timestamp}`);

  const bq = await bullmqSnapshot();
  if (bq.status === "skipped") {
    components.bullmq = { status: "skipped", detail: "no_redis" };
  } else if (bq.status === "error") {
    components.bullmq = { status: "error" };
    logger.warn(`[health] BullMQ queue probe failed at ${timestamp}`);
  } else {
    components.bullmq = {
      status: "ok",
      detail: `briefing failed=${bq.briefing.failed} active=${bq.briefing.active}; pdf failed=${bq.pdf.failed} active=${bq.pdf.active}; maintenance failed=${bq.maintenance.failed}`
    };
  }

  let lastBriefingAt: string | null = null;
  try {
    const last = await prisma.briefing.findFirst({
      orderBy: { sentAt: "desc" },
      select: { sentAt: true }
    });
    lastBriefingAt = last?.sentAt.toISOString() ?? null;
    components.last_briefing = { status: "ok", detail: lastBriefingAt ?? "never" };
  } catch {
    components.last_briefing = { status: "error" };
    logger.warn(`[health] last briefing query failed at ${timestamp}`);
  }

  const anyError = Object.values(components).some((c) => c.status === "error");
  const status = dbOk && !anyError ? "ok" : "degraded";

  return { status, timestamp, components };
}
