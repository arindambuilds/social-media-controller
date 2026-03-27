/*
  Warnings:

  - You are about to drop the column `createdAt` on the `AiInsight` table. All the data in the column will be lost.
  - You are about to drop the column `payload` on the `AiInsight` table. All the data in the column will be lost.
  - You are about to drop the column `periodEnd` on the `AiInsight` table. All the data in the column will be lost.
  - You are about to drop the column `periodStart` on the `AiInsight` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `AiInsight` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `AiInsight` table. All the data in the column will be lost.
  - Added the required column `platform` to the `AiInsight` table without a default value. This is not possible if the table is not empty.
  - Added the required column `recommendations` to the `AiInsight` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AiInsight" DROP COLUMN "createdAt",
DROP COLUMN "payload",
DROP COLUMN "periodEnd",
DROP COLUMN "periodStart",
DROP COLUMN "title",
DROP COLUMN "type",
ADD COLUMN     "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "platform" "Platform" NOT NULL,
ADD COLUMN     "recommendations" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "engagementStats" JSONB;

-- CreateIndex
CREATE INDEX "AiInsight_clientId_generatedAt_idx" ON "AiInsight"("clientId", "generatedAt");
