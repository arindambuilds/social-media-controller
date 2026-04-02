/**
 * Shared DB client for the API. In pooled environments (Render + PgBouncer), always add `pgbouncer=true` to `DATABASE_URL`.
 */
import { PrismaClient } from "@prisma/client";

const dbUrl = process.env.DATABASE_URL ?? "";
const missingPgbouncerFlag =
  process.env.NODE_ENV === "production" &&
  dbUrl.length > 0 &&
  (/:6543\b/.test(dbUrl) || /pooler/i.test(dbUrl)) &&
  !/pgbouncer=true/i.test(dbUrl);

if (missingPgbouncerFlag) {
  console.warn(
    "[prisma] DATABASE_URL looks like a pooled Postgres URL but is missing pgbouncer=true. " +
      "PgBouncer (transaction mode) often causes prepared statement errors (e.g. s0, s9). " +
      "Append &pgbouncer=true to DATABASE_URL on Render. See https://pris.ly/d/pgbouncer"
  );
}

export const prisma = new PrismaClient();
