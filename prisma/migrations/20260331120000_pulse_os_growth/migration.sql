-- PulseOS: onboarding, streaks, tier snapshot, nudge dedupe

-- CreateTable
CREATE TABLE "PulseNudgeLog" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "nudgeKey" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PulseNudgeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PulseNudgeLog_clientId_nudgeKey_createdAt_idx" ON "PulseNudgeLog"("clientId", "nudgeKey", "createdAt");

-- AddForeignKey
ALTER TABLE "PulseNudgeLog" ADD CONSTRAINT "PulseNudgeLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN "businessType" TEXT,
ADD COLUMN "metricsTrackedJson" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN "briefingStreakCurrent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "briefingStreakBest" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "briefingStreakLastDateIst" TEXT,
ADD COLUMN "lastWeeklySummaryAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Briefing" ADD COLUMN "pulseTierSnapshot" TEXT;
