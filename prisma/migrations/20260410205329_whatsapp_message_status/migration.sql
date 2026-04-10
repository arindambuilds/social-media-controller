-- AlterTable
ALTER TABLE "dm_messages" ADD COLUMN     "messageStatus" TEXT,
ADD COLUMN     "metaMessageId" TEXT;

-- CreateTable
CREATE TABLE "whatsapp_messages" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "waId" TEXT NOT NULL,
    "metaMessageId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "content" TEXT,
    "messageType" TEXT NOT NULL DEFAULT 'text',
    "status" TEXT NOT NULL DEFAULT 'sent',
    "failureReason" TEXT,
    "withinWindow" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_messages_metaMessageId_key" ON "whatsapp_messages"("metaMessageId");

-- CreateIndex
CREATE INDEX "whatsapp_messages_clientId_createdAt_idx" ON "whatsapp_messages"("clientId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "whatsapp_messages_waId_createdAt_idx" ON "whatsapp_messages"("waId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "whatsapp_messages_metaMessageId_idx" ON "whatsapp_messages"("metaMessageId");
