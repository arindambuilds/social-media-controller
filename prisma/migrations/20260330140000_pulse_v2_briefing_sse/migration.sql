-- CreateEnum
CREATE TYPE "BriefingStatus" AS ENUM ('PENDING', 'GENERATING', 'COMPLETE', 'FAILED');

-- AlterTable
ALTER TABLE "Briefing" ADD COLUMN     "tipText" TEXT,
ADD COLUMN     "metricsJson" JSONB,
ADD COLUMN     "status" "BriefingStatus" NOT NULL DEFAULT 'COMPLETE';

-- CreateTable
CREATE TABLE "BriefingFeedback" (
    "id" TEXT NOT NULL,
    "briefingId" TEXT NOT NULL,
    "userId" TEXT,
    "tipRating" TEXT NOT NULL,
    "freeText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BriefingFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsageLog" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BriefingFeedback_briefingId_idx" ON "BriefingFeedback"("briefingId");

-- CreateIndex
CREATE INDEX "AiUsageLog_clientId_createdAt_idx" ON "AiUsageLog"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageLog_feature_idx" ON "AiUsageLog"("feature");

-- AddForeignKey
ALTER TABLE "BriefingFeedback" ADD CONSTRAINT "BriefingFeedback_briefingId_fkey" FOREIGN KEY ("briefingId") REFERENCES "Briefing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefingFeedback" ADD CONSTRAINT "BriefingFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
