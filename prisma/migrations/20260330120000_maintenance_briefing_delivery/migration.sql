-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "briefingHourIst" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN     "preferredInstagramHandle" TEXT,
ADD COLUMN     "ingestionPausedUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Briefing" ADD COLUMN     "whatsappDelivered" BOOLEAN,
ADD COLUMN     "emailDelivered" BOOLEAN;

-- CreateTable
CREATE TABLE "SystemEvent" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SystemEvent_createdAt_idx" ON "SystemEvent"("createdAt");

-- CreateIndex
CREATE INDEX "SystemEvent_category_createdAt_idx" ON "SystemEvent"("category", "createdAt");
