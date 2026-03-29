-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "dmAutoReplyEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dmBusinessContext" TEXT,
ADD COLUMN     "dmOwnerTone" TEXT;

-- CreateTable
CREATE TABLE "DmConversation" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "instagramUserId" TEXT NOT NULL,
    "senderName" TEXT,
    "leadCaptured" BOOLEAN NOT NULL DEFAULT false,
    "leadId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DmConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DmMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sentByAi" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DOUBLE PRECISION,
    "intentLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DmMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DmConversation_clientId_instagramUserId_idx" ON "DmConversation"("clientId", "instagramUserId");

-- CreateIndex
CREATE UNIQUE INDEX "DmConversation_clientId_instagramUserId_key" ON "DmConversation"("clientId", "instagramUserId");

-- CreateIndex
CREATE INDEX "DmMessage_conversationId_idx" ON "DmMessage"("conversationId");

-- AddForeignKey
ALTER TABLE "DmConversation" ADD CONSTRAINT "DmConversation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmMessage" ADD CONSTRAINT "DmMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "DmConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
