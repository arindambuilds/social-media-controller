-- Add new social account metadata for Instagram onboarding and sync tracking
ALTER TABLE "SocialAccount" ADD COLUMN "platformUsername" TEXT;
ALTER TABLE "SocialAccount" ADD COLUMN "pageId" TEXT;
ALTER TABLE "SocialAccount" ADD COLUMN "pageName" TEXT;
ALTER TABLE "SocialAccount" ADD COLUMN "lastSyncedAt" TIMESTAMP(3);
ALTER TABLE "SocialAccount" ADD COLUMN "metadata" JSONB;

-- CreateEnum
CREATE TYPE "SyncRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "SyncTrigger" AS ENUM ('MANUAL', 'WEBHOOK', 'OAUTH_CONNECT', 'SCHEDULED');

-- CreateTable
CREATE TABLE "PostMetricDaily" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "likes" INTEGER NOT NULL DEFAULT 0,
  "commentsCount" INTEGER NOT NULL DEFAULT 0,
  "shares" INTEGER NOT NULL DEFAULT 0,
  "saves" INTEGER NOT NULL DEFAULT 0,
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "reach" INTEGER NOT NULL DEFAULT 0,
  "engagementRate" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PostMetricDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "socialAccountId" TEXT NOT NULL,
  "platform" "Platform" NOT NULL,
  "trigger" "SyncTrigger" NOT NULL DEFAULT 'MANUAL',
  "status" "SyncRunStatus" NOT NULL DEFAULT 'PENDING',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "recordsFetched" INTEGER NOT NULL DEFAULT 0,
  "externalCursor" TEXT,
  "errorMessage" TEXT,
  CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiInsight" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "text" TEXT NOT NULL,
  "sourceData" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PostMetricDaily_postId_date_key" ON "PostMetricDaily"("postId", "date");

-- AddForeignKey
ALTER TABLE "PostMetricDaily"
ADD CONSTRAINT "PostMetricDaily_postId_fkey"
FOREIGN KEY ("postId") REFERENCES "Post"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRun"
ADD CONSTRAINT "SyncRun_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRun"
ADD CONSTRAINT "SyncRun_socialAccountId_fkey"
FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiInsight"
ADD CONSTRAINT "AiInsight_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation"
ADD CONSTRAINT "Recommendation_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
