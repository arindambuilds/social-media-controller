import "dotenv/config";
import { createApp } from "./app";
import { redisConnection } from "./lib/redis";
import { printStartupSummary } from "./lib/startupSummary";
import { startBriefingWorker } from "./workers/briefingWorker";
import { initMaintenanceJobs, startMaintenanceWorker } from "./workers/maintenanceWorker";

if (process.env.NODE_ENV === "production") {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (
    dbUrl.includes("localhost") ||
    dbUrl.includes("127.0.0.1") ||
    dbUrl.includes("@0.0.0.0")
  ) {
    console.error(
      "FATAL: DATABASE_URL points to localhost in production. " +
        "Set DATABASE_URL to the Supabase transaction pooler (:6543) and DIRECT_URL to the direct Postgres connection (:5432) in your production environment variables."
    );
    process.exit(1);
  }
}

const app = createApp();
const PORT = Number(process.env.PORT) || 8080;

if (process.env.NODE_ENV === "production" && redisConnection) {
  startBriefingWorker();
  startMaintenanceWorker();
  void initMaintenanceJobs();
}

void printStartupSummary(PORT);

const server = app.listen(PORT, "0.0.0.0", () => {
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
