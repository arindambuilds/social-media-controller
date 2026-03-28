import path from "path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma skips auto-loading .env when prisma.config.ts exists — load root .env explicitly.
loadEnv({ path: path.resolve(process.cwd(), ".env") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl?.trim()) {
  throw new Error(
    "DATABASE_URL is missing or empty. Set it in .env at the project root (e.g. postgresql://user:pass@localhost:5432/db?schema=public)."
  );
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts"
  },
  datasource: {
    url: databaseUrl
  }
});
