/**
 * Shared DB client for the API. In pooled environments (Render + PgBouncer), always add `pgbouncer=true` to `DATABASE_URL`.
 */
import { PrismaClient } from "@prisma/client";
import { logger } from "./logger";

const dbUrl = process.env.DATABASE_URL ?? "";
const missingPgbouncerFlag =
  process.env.NODE_ENV === "production" &&
  dbUrl.length > 0 &&
  (/:6543\b/.test(dbUrl) || /pooler/i.test(dbUrl)) &&
  !/pgbouncer=true/i.test(dbUrl);

if (missingPgbouncerFlag) {
  logger.warn("DATABASE_URL looks pooled but missing pgbouncer=true", {
    event: "prisma_pgbouncer_flag_missing"
  });
}

export const prisma = new PrismaClient();
