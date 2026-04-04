import "dotenv/config";
import { PrismaClient } from "@prisma/client";

type ParsedTarget = {
  host: string;
  name: string;
};

type MigrationSummary = {
  latest: string | null;
  appliedAt: string | null;
  note?: string;
};

function parsePostgresTarget(urlString: string): ParsedTarget {
  const parsed = new URL(urlString);
  return {
    host: parsed.hostname || "unknown",
    name: parsed.pathname.replace(/^\/+/, "") || "postgres"
  };
}

function printMissingEnv(message: string): never {
  console.error(`ERROR: ${message}`);
  process.exit(1);
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

function formatLatest(summary: MigrationSummary): string {
  if (!summary.latest) {
    return summary.note ? `(none: ${summary.note})` : "(none)";
  }
  return summary.latest;
}

async function main() {
  const runtimeUrl = process.env.DATABASE_URL?.trim();
  const directUrl = process.env.DIRECT_URL?.trim();

  if (!runtimeUrl) {
    printMissingEnv("DATABASE_URL is missing. Add it to .env or your shell before running db:check.");
  }
  if (!directUrl) {
    printMissingEnv("DIRECT_URL is missing. Add it to .env or your shell before running db:check.");
  }

  let runtimeTarget: ParsedTarget;
  let directTarget: ParsedTarget;
  try {
    runtimeTarget = parsePostgresTarget(runtimeUrl);
    directTarget = parsePostgresTarget(directUrl);
  } catch {
    printMissingEnv("DATABASE_URL or DIRECT_URL is not a valid PostgreSQL URL.");
  }

  console.log("Database targets");
  console.log(`- DATABASE_URL (runtime): ${runtimeTarget.host} / ${runtimeTarget.name}`);
  console.log(`- DIRECT_URL   (migrate): ${directTarget.host} / ${directTarget.name}`);
  console.log("");

  const [runtimeMigration, directMigration] = await Promise.all([
    queryLatestMigration(runtimeUrl),
    queryLatestMigration(directUrl)
  ]);

  const aligned = runtimeMigration.latest === directMigration.latest;

  console.log("Latest applied migration");
  console.log(
    `- DATABASE_URL  (runtime): ${formatLatest(runtimeMigration)}${runtimeMigration.appliedAt ? ` @ ${runtimeMigration.appliedAt}` : ""}`
  );
  console.log(
    `- DIRECT_URL    (migrate): ${formatLatest(directMigration)}${directMigration.appliedAt ? ` @ ${directMigration.appliedAt}` : ""}`
  );
  console.log("");

  if (aligned) {
    console.log("✅ ALIGNED");
    if (
      runtimeTarget.host !== directTarget.host ||
      runtimeTarget.name !== directTarget.name
    ) {
      console.log(
        "Note: DATABASE_URL and DIRECT_URL point to different targets but currently share the same latest migration."
      );
    }
    return;
  }

  console.log("❌ MISMATCH");
  console.log("");
  console.log(`DATABASE_URL  (runtime): ${formatLatest(runtimeMigration)}`);
  console.log(`DIRECT_URL    (migrate): ${formatLatest(directMigration)}`);
  console.log("→ Run: npx prisma migrate deploy to bring the target runtime DB up to date.");
  process.exitCode = 1;
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`ERROR: ${message}`);
  process.exit(1);
});
