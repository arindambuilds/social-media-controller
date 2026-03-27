-- DropForeignKey
ALTER TABLE "AiInsight" DROP CONSTRAINT "AiInsight_clientId_fkey";

-- DropIndex
DROP INDEX "AiInsight_clientId_generatedAt_idx";

-- CreateIndex
CREATE INDEX "AiInsight_clientId_idx" ON "AiInsight"("clientId");

-- AddForeignKey
ALTER TABLE "AiInsight" ADD CONSTRAINT "AiInsight_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
