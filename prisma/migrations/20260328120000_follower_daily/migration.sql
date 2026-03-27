-- AlterTable
ALTER TABLE "SocialAccount" ADD COLUMN "followerCount" INTEGER;

-- CreateTable
CREATE TABLE "FollowerDaily" (
    "id" TEXT NOT NULL,
    "socialAccountId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "followerCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowerDaily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FollowerDaily_socialAccountId_date_key" ON "FollowerDaily"("socialAccountId", "date");
CREATE INDEX "FollowerDaily_socialAccountId_idx" ON "FollowerDaily"("socialAccountId");

ALTER TABLE "FollowerDaily" ADD CONSTRAINT "FollowerDaily_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
