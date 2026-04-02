import { defineConfig } from "vitest/config";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Vitest doesn't auto-load `.env.test`; load it so test DB gating can enable DB-backed suites.
const envTestPath = path.resolve(process.cwd(), ".env.test");
if (fs.existsSync(envTestPath)) {
  dotenv.config({ path: envTestPath, override: false });
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    env: {
      NODE_ENV: process.env.NODE_ENV ?? "test",
      DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://test:test@localhost:5432/test",
      JWT_SECRET: process.env.JWT_SECRET ?? "vitest-jwt-secret-must-be-at-least-32-chars",
      JWT_REFRESH_SECRET:
        process.env.JWT_REFRESH_SECRET ?? "vitest-refresh-secret-min-32-characters-x"
    }
  }
});
