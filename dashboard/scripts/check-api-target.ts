import { PrismaClient } from "../../src/generated/prisma";
import fs from "node:fs";
import path from "node:path";

type EnvMap = Record<string, string>;

type MigrationSummary = {
  latest: string | null;
  appliedAt: string | null;
  note?: string;
};

type DbHealthResponse = {
  status: string;
  database?: {
    host?: string;
    name?: string;
    reachable?: boolean;
  };
  migrations?: {
    latest?: string | null;
    appliedAt?: string | null;
  };
  message?: string;
};

function parseEnvFile(filePath: string): EnvMap {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const env: EnvMap = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    value = value.replace(/^['"]|['"]$/g, "");
    env[key] = value;
  }
  return env;
}

function parsePostgresTarget(urlString: string): { host: string; name: string } {
  const parsed = new URL(urlString);
  return {
    host: parsed.hostname || "unknown",
    name: parsed.pathname.replace(/^\/+/, "") || "postgres"
  };
}

function isMissingRelationError(error: unknown, relationName: string): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes(`relation "${relationName}" does not exist`) ||
    message.includes(`table ${relationName}`) ||
    message.includes("42P01")
  );
}

async function queryLatestMigration(databaseUrl: string): Promise<MigrationSummary> {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl
      }
    }
  });

  try {
    await prisma.$queryRaw`SELECT 1`;
    const rows = await prisma.$queryRaw<Array<{ latest: string; appliedAt: Date }>>`
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
      return {
        latest: null,
        appliedAt: null,
        note: "missing _prisma_migrations"
      };
    }
    throw error;
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

async function main() {
  const dashboardRoot = process.cwd();
  const repoRoot = path.resolve(dashboardRoot, "..");
  const dashboardEnv = parseEnvFile(path.join(dashboardRoot, ".env.local"));
  const rootEnv = parseEnvFile(path.join(repoRoot, ".env"));

  const apiUrl = dashboardEnv.NEXT_PUBLIC_API_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim();
  const rootDatabaseUrl = rootEnv.DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();

  if (!apiUrl) {
    console.error("ERROR: NEXT_PUBLIC_API_URL is missing in dashboard/.env.local.");
    process.exit(1);
  }

  if (!rootDatabaseUrl) {
    console.error("ERROR: Root .env is missing DATABASE_URL.");
    process.exit(1);
  }

  const apiHealthUrl = `${apiUrl.replace(/\/+$/, "")}/api/health/db`;
  const response = await fetch(apiHealthUrl);
  const body = (await response.json().catch(() => null)) as DbHealthResponse | null;

  console.log("API health response");
  console.log(JSON.stringify(body, null, 2));
  console.log("");

  if (!response.ok || !body?.database) {
    console.error(
      `ERROR: ${apiHealthUrl} did not return a usable database health response.`
    );
    process.exit(1);
  }

  const localTarget = parsePostgresTarget(rootDatabaseUrl);
  const localMigration = await queryLatestMigration(rootDatabaseUrl);

  console.log(`Dashboard is pointing to:  ${apiUrl}`);
  console.log(`That API's database:       ${body.database.host ?? "unknown"} / ${body.database.name ?? "unknown"}`);
  console.log(`Latest migration there:    ${body.migrations?.latest ?? "(none)"}`);
  console.log("");
  console.log(`Root .env DATABASE_URL:    ${localTarget.host} / ${localTarget.name}`);
  console.log(`Local latest migration:    ${localMigration.latest ?? "(none)"}`);
  console.log("");

  const sameTarget =
    (body.database.host ?? "unknown") === localTarget.host &&
    (body.database.name ?? "unknown") === localTarget.name;

  if (sameTarget) {
    console.log("✅ Dashboard API target matches the database in the root .env.");
    return;
  }

  console.log(`⚠️  Dashboard → ${apiUrl}, but root .env points to ${localTarget.host} / ${localTarget.name}.`);
  console.log("    Migrations run locally will NOT affect the API target above.");
  console.log("    To migrate that target, set DIRECT_URL to the direct connection string for the API's database,");
  console.log("    then run: npx prisma migrate deploy");
  process.exitCode = 1;
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`ERROR: ${message}`);
  process.exit(1);
});
