module.exports = {
  apps: [
    {
      name: "smc-api",
      script: "dist/server.js",
      instances: 1,
      exec_mode: "fork"
    },
    {
      name: "smc-worker",
      script: "dist/workers/ingestionWorker.js",
      instances: 1,
      exec_mode: "fork"
    },
    {
      name: "smc-scheduler",
      script: "dist/scheduler/tokenRefreshScheduler.js",
      instances: 1,
      exec_mode: "fork"
    }
  ]
};
