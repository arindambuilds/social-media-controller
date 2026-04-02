import path from "path";
import fs from "fs";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma skips auto-loading env when prisma.config.ts exists — load the correct file explicitly.
// For test runs we want `.env.test`, otherwise migrations target the wrong datasource.
const envFile =
  process.env.NODE_ENV === "test" && fs.existsSync(path.resolve(process.cwd(), ".env.test"))
    ? ".env.test"
    : ".env";
loadEnv({ path: path.resolve(process.cwd(), envFile), override: true });

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is missing or empty. Set it in .env at the project root. Local Postgres may use :5432; Supabase/Render runtime must use the transaction pooler on :6543."
  );
}
// Prisma CLI validates env("DIRECT_URL") from schema. Mirror DATABASE_URL only for local single-host Postgres setups.
if (!process.env.DIRECT_URL?.trim()) {
  process.env.DIRECT_URL = databaseUrl;
}
// Migrations/introspection use direct Postgres (DIRECT_URL, typically :5432). Runtime queries use DATABASE_URL (e.g. Supabase transaction pooler :6543).
const directUrl = process.env.DIRECT_URL.trim();

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts"
  },
  datasource: {
    url: databaseUrl,
    directUrl
  }
});
