import "dotenv/config";
import express, { type Router } from "express";
import cors from "cors";

const app = express();
const PORT = Number(process.env.PORT) || 8080;

app.use(
  cors({
    origin: [
      "https://social-media-controller.vercel.app",
      "http://localhost:3000",
      "http://localhost:3002"
    ],
    credentials: true
  })
);

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ status: "ok", message: "API running" });
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

function loadRoute(
  modulePath: string,
  exportName: string,
  mountPath: string
): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(modulePath) as Record<string, Router>;
    const router = mod[exportName];
    if (!router) {
      console.warn(`Route module ${modulePath} has no export ${exportName}`);
      return;
    }
    app.use(mountPath, router);
  } catch (e: unknown) {
    console.warn(
      `Failed to load ${mountPath}:`,
      e instanceof Error ? e.message : e
    );
  }
}

loadRoute("./routes/auth", "authRouter", "/api/auth");
loadRoute("./routes/analytics", "analyticsRouter", "/api/analytics");
loadRoute("./routes/ai", "aiRouter", "/api/ai");
loadRoute("./routes/leads", "leadsRouter", "/api/leads");

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
