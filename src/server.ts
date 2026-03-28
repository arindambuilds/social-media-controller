import "dotenv/config";
import { env } from "./config/env";
import { createApp } from "./app";

/** Fail fast in production if DATABASE_URL still points at local Postgres (common Render misconfiguration). */
function assertProductionDatabaseHost(): void {
  if (env.NODE_ENV !== "production") return;
  const u = env.DATABASE_URL.toLowerCase();
  const looksLocal =
    u.includes("localhost") || u.includes("127.0.0.1") || u.includes("@0.0.0.0");
  if (!looksLocal) return;
  console.error(
    "[FATAL] DATABASE_URL targets localhost in NODE_ENV=production.",
    "Fix: Render Dashboard → your Web Service → Environment → set DATABASE_URL to your Render PostgreSQL connection string (from the database resource)."
  );
  process.exit(1);
}

assertProductionDatabaseHost();

const app = createApp();
const PORT = Number(process.env.PORT) || 8080;

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server started on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

server.on("error", (err) => {
  console.error("Server error:", err);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

export default app;
