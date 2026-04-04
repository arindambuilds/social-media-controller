import { Router } from "express";
import { env } from "../config/env";
import { getPublicHealthSnapshot, withHealthProbeTimeout } from "../lib/healthCheck";
import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";

type DatabaseIdentityRow = {
  name: string;
  serverAddress: string | null;
  serverPort: number | null;
};

type LatestMigrationRow = {
  latest: string;
  appliedAt: Date;
};

type LatestMigration = {
  latest: string | null;
  appliedAt: string | null;
};

export const healthRouter = Router();

function parseConfiguredDatabaseTarget(databaseUrl: string): {
  host: string;
  name: string;
} {
  try {
    const parsed = new URL(databaseUrl);
    return {
      host: parsed.hostname || "unknown",
      name: parsed.pathname.replace(/^\/+/, "") || "postgres"
    };
  } catch {
    return {
      host: "unknown",
      name: "unknown"
    };
  }
}

function isMissingRelationError(error: unknown, relationName: string): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes(`relation "${relationName}" does not exist`) ||
    message.includes(`table ${relationName}`) ||
    message.includes("42P01")
  );
}

async function getLatestAppliedMigration(): Promise<LatestMigration> {
  try {
    const rows = await prisma.$queryRaw<LatestMigrationRow[]>`
      SELECT
        migration_name AS latest,
        COALESCE(finished_at, started_at) AS "appliedAt"
      FROM "_prisma_migrations"
      WHERE rolled_back_at IS NULL
      ORDER BY finished_at DESC NULLS LAST, started_at DESC
      LIMIT 1
    `;

    const latest = rows[0];
    return {
      latest: latest?.latest ?? null,
      appliedAt: latest?.appliedAt?.toISOString() ?? null
    };
  } catch (error) {
    if (isMissingRelationError(error, "_prisma_migrations")) {
      return { latest: null, appliedAt: null };
    }
    throw error;
  }
}

healthRouter.get("/", async (req, res) => {
  try {
    const payload: Record<string, unknown> = {
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV === "production" ? "production" : env.NODE_ENV
    };
    const wantDeps = req.query.deps === "1" || req.query.deps === "true";
    if (!wantDeps) {
      res.status(200).json(payload);
      return;
    }
    const snapshot = await withHealthProbeTimeout(getPublicHealthSnapshot());
    payload.status = snapshot.status;
    payload.timestamp = snapshot.timestamp;
    payload.components = snapshot.components;
    res.status(200).json(payload);
  } catch (err) {
    logger.warn("/api/health failed", {
      message: err instanceof Error ? err.message : String(err)
    });
    res.status(200).json({
      status: "degraded",
      timestamp: new Date().toISOString(),
      message: "Health check dependency error."
    });
  }
});

healthRouter.get("/db", async (_req, res) => {
  try {
    const [identity] = await withHealthProbeTimeout(
      prisma.$queryRaw<DatabaseIdentityRow[]>`
        SELECT
          current_database()::text AS name,
          inet_server_addr()::text AS "serverAddress",
          inet_server_port() AS "serverPort"
      `
    );
    const latestMigration = await withHealthProbeTimeout(getLatestAppliedMigration());
    const configured = parseConfiguredDatabaseTarget(env.DATABASE_URL);

    res.status(200).json({
      status: "ok",
      database: {
        host: configured.host || identity?.serverAddress || "unknown",
        name: identity?.name || configured.name,
        reachable: true
      },
      migrations: latestMigration
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database health probe failed.";
    logger.warn("/api/health/db failed", { message });
    res.status(500).json({
      status: "error",
      message
    });
  }
});

