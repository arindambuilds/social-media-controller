import { defineConfig } from "vitest/config";

/** Ensure createApp() env validation passes when .env is absent (CI); DATABASE_URL still required for DB-backed tests. */
const JWT_PLACEHOLDER = "vitest-jwt-secret-must-be-at-least-32-chars";
const REFRESH_PLACEHOLDER = "vitest-refresh-secret-min-32-characters-x";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    env: {
      JWT_SECRET: process.env.JWT_SECRET ?? JWT_PLACEHOLDER,
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? REFRESH_PLACEHOLDER,
      NODE_ENV: process.env.NODE_ENV ?? "test"
    }
  }
});
