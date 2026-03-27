-- AlterTable
ALTER TABLE "AiInsight" ADD COLUMN     "keyInsights" JSONB,
ADD COLUMN     "warning" TEXT,
ADD COLUMN     "userFeedback" INTEGER;

-- CreateTable
CREATE TABLE "AiMonthlyUsage" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiMonthlyUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiMonthlyUsage_clientId_monthKey_key" ON "AiMonthlyUsage"("clientId", "monthKey");

-- CreateIndex
CREATE INDEX "AiMonthlyUsage_clientId_idx" ON "AiMonthlyUsage"("clientId");
