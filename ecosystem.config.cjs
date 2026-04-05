/**
 * PM2 example: API without embedded PDF worker + dedicated PDF worker process.
 * Build first: `npm run build` then start from repo root.
 *
 * Stateless JWT → cluster mode needs no sticky sessions.
 * Prefer **2 instances on a larger dyno** (e.g. 16GB) over 4× on 8GB to avoid idle RSS duplication;
 * raise `instances` when CPU-bound, not blindly for memory.
 */
module.exports = {
  apps: [
    {
      name: "pulse-api",
      script: "dist/index.js",
      instances: 2,
      exec_mode: "cluster",
      max_memory_restart: "2G",
      kill_timeout: 5000,
      env: {
        NODE_ENV: "production",
        START_PDF_WORKER_IN_API: "false"
      }
    },
    {
      name: "pulse-pdf-worker",
      script: "dist/workers/pdfWorkerEntry.js",
      instances: 2,
      exec_mode: "fork",
      max_memory_restart: "6G",
      kill_timeout: 8000,
      env: { NODE_ENV: "production" }
    }
  ]
};
