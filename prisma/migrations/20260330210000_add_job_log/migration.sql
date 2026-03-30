-- BullMQ job audit trail (queue + Redis job id); optional Prisma writes from workers — failures never break jobs.

CREATE TABLE "JobLog" (
    "id" TEXT NOT NULL,
    "queue" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "data" JSONB,
    "result" JSONB,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JobLog_queue_jobId_key" ON "JobLog"("queue", "jobId");

CREATE INDEX "JobLog_queue_status_idx" ON "JobLog"("queue", "status");

CREATE INDEX "JobLog_createdAt_idx" ON "JobLog"("createdAt");
