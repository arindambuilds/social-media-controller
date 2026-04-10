-- AlterTable
ALTER TABLE "users" ADD COLUMN     "businessName" TEXT,
ADD COLUMN     "businessType" TEXT,
ADD COLUMN     "hasDemoData" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboardingStep" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DemoData" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seededAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversationIds" TEXT[],
    "reportIds" TEXT[],

    CONSTRAINT "DemoData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DemoData_userId_key" ON "DemoData"("userId");

-- AddForeignKey
ALTER TABLE "DemoData" ADD CONSTRAINT "DemoData_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
