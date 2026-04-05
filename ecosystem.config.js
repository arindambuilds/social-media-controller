/**
 * PM2 process file — use after `npm run build` (outputs to `dist/`).
 * Example: pm2 start ecosystem.config.js
 */
module.exports = {
  apps: [
    {
      name: "smc-api",
      script: "dist/index.js",
      instances: 1,
      exec_mode: "fork"
    },
    {
      name: "smc-ingestion-worker",
      script: "dist/workers/ingestionWorker.js",
      instances: 1,
      exec_mode: "fork"
    },
    {
      name: "smc-post-publish-worker",
      script: "dist/workers/postPublishWorker.js",
      instances: 1,
      exec_mode: "fork"
    },
    {
      name: "smc-token-refresh-worker",
      script: "dist/workers/tokenRefreshWorker.js",
      instances: 1,
      exec_mode: "fork"
    }
  ]
};
