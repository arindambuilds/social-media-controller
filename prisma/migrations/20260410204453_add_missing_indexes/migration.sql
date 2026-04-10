-- CreateIndex
CREATE INDEX "audit_logs_clientId_createdAt_idx" ON "audit_logs"("clientId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "campaigns_clientId_idx" ON "campaigns"("clientId");

-- CreateIndex
CREATE INDEX "clients_ownerId_idx" ON "clients"("ownerId");

-- CreateIndex
CREATE INDEX "clients_agencyId_idx" ON "clients"("agencyId");

-- CreateIndex
CREATE INDEX "leads_clientId_createdAt_idx" ON "leads"("clientId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "posts_socialAccountId_publishedAt_idx" ON "posts"("socialAccountId", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "social_accounts_clientId_idx" ON "social_accounts"("clientId");

-- CreateIndex
CREATE INDEX "sync_runs_clientId_status_idx" ON "sync_runs"("clientId", "status");

-- CreateIndex
CREATE INDEX "sync_runs_socialAccountId_idx" ON "sync_runs"("socialAccountId");
