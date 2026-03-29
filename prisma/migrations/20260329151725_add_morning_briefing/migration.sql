-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_clientId_fkey";

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "briefingEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "whatsappNumber" TEXT;

-- CreateTable
CREATE TABLE "Briefing" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Briefing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Briefing_clientId_idx" ON "Briefing"("clientId");

-- CreateIndex
CREATE INDEX "Briefing_clientId_sentAt_idx" ON "Briefing"("clientId", "sentAt");

-- AddForeignKey
ALTER TABLE "Briefing" ADD CONSTRAINT "Briefing_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
