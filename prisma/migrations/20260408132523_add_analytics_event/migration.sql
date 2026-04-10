-- AlterTable
ALTER TABLE "ai_insights" RENAME CONSTRAINT "AiInsight_pkey" TO "ai_insights_pkey";

-- AlterTable
ALTER TABLE "ai_monthly_usages" RENAME CONSTRAINT "AiMonthlyUsage_pkey" TO "ai_monthly_usages_pkey";

-- AlterTable
ALTER TABLE "ai_usage_logs" RENAME CONSTRAINT "AiUsageLog_pkey" TO "ai_usage_logs_pkey";

-- AlterTable
ALTER TABLE "audit_logs" RENAME CONSTRAINT "AuditLog_pkey" TO "audit_logs_pkey";

-- AlterTable
ALTER TABLE "briefing_feedbacks" RENAME CONSTRAINT "BriefingFeedback_pkey" TO "briefing_feedbacks_pkey";

-- AlterTable
ALTER TABLE "briefings" RENAME CONSTRAINT "Briefing_pkey" TO "briefings_pkey";

-- AlterTable
ALTER TABLE "campaigns" RENAME CONSTRAINT "Campaign_pkey" TO "campaigns_pkey";

-- AlterTable
ALTER TABLE "clients" RENAME CONSTRAINT "Client_pkey" TO "clients_pkey";

-- AlterTable
ALTER TABLE "comments" RENAME CONSTRAINT "Comment_pkey" TO "comments_pkey";

-- AlterTable
ALTER TABLE "dm_conversations" RENAME CONSTRAINT "DmConversation_pkey" TO "dm_conversations_pkey";

-- AlterTable
ALTER TABLE "dm_messages" RENAME CONSTRAINT "DmMessage_pkey" TO "dm_messages_pkey";

-- AlterTable
ALTER TABLE "email_logs" RENAME CONSTRAINT "EmailLog_pkey" TO "email_logs_pkey";

-- AlterTable
ALTER TABLE "email_suppressions" RENAME CONSTRAINT "EmailSuppression_pkey" TO "email_suppressions_pkey";

-- AlterTable
ALTER TABLE "follower_dailies" RENAME CONSTRAINT "FollowerDaily_pkey" TO "follower_dailies_pkey";

-- AlterTable
ALTER TABLE "job_logs" RENAME CONSTRAINT "JobLog_pkey" TO "job_logs_pkey";

-- AlterTable
ALTER TABLE "leads" RENAME CONSTRAINT "Lead_pkey" TO "leads_pkey";

-- AlterTable
ALTER TABLE "messages" RENAME CONSTRAINT "Message_pkey" TO "messages_pkey";

-- AlterTable
ALTER TABLE "notifications" RENAME CONSTRAINT "Notification_pkey" TO "notifications_pkey";

-- AlterTable
ALTER TABLE "post_insights" RENAME CONSTRAINT "PostInsight_pkey" TO "post_insights_pkey";

-- AlterTable
ALTER TABLE "post_metric_dailies" RENAME CONSTRAINT "PostMetricDaily_pkey" TO "post_metric_dailies_pkey";

-- AlterTable
ALTER TABLE "posts" RENAME CONSTRAINT "Post_pkey" TO "posts_pkey";

-- AlterTable
ALTER TABLE "pulse_nudge_logs" RENAME CONSTRAINT "PulseNudgeLog_pkey" TO "pulse_nudge_logs_pkey";

-- AlterTable
ALTER TABLE "recommendations" RENAME CONSTRAINT "Recommendation_pkey" TO "recommendations_pkey";

-- AlterTable
ALTER TABLE "scheduled_posts" RENAME CONSTRAINT "ScheduledPost_pkey" TO "scheduled_posts_pkey";

-- AlterTable
ALTER TABLE "social_accounts" RENAME CONSTRAINT "SocialAccount_pkey" TO "social_accounts_pkey";

-- AlterTable
ALTER TABLE "social_accounts" ADD COLUMN "needsReauth" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "social_accounts" ADD COLUMN "syncStatus" TEXT NOT NULL DEFAULT 'idle';

-- AlterTable
ALTER TABLE "sync_runs" RENAME CONSTRAINT "SyncRun_pkey" TO "sync_runs_pkey";

-- AlterTable
ALTER TABLE "system_events" RENAME CONSTRAINT "SystemEvent_pkey" TO "system_events_pkey";

-- AlterTable
ALTER TABLE "users" RENAME CONSTRAINT "User_pkey" TO "users_pkey";

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "pdfStatus" TEXT NOT NULL DEFAULT 'pending',
    "pdfUrl" TEXT,
    "pdfJobId" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "userId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reports_clientId_idx" ON "reports"("clientId");

-- CreateIndex
CREATE INDEX "reports_userId_idx" ON "reports"("userId");

-- CreateIndex
CREATE INDEX "analytics_events_eventType_createdAt_idx" ON "analytics_events"("eventType", "createdAt");

-- RenameForeignKey
ALTER TABLE "ai_insights" RENAME CONSTRAINT "AiInsight_clientId_fkey" TO "ai_insights_clientId_fkey";

-- RenameForeignKey
ALTER TABLE "audit_logs" RENAME CONSTRAINT "AuditLog_clientId_fkey" TO "audit_logs_clientId_fkey";

-- RenameForeignKey
ALTER TABLE "briefing_feedbacks" RENAME CONSTRAINT "BriefingFeedback_briefingId_fkey" TO "briefing_feedbacks_briefingId_fkey";

-- RenameForeignKey
ALTER TABLE "briefing_feedbacks" RENAME CONSTRAINT "BriefingFeedback_userId_fkey" TO "briefing_feedbacks_userId_fkey";

-- RenameForeignKey
ALTER TABLE "briefings" RENAME CONSTRAINT "Briefing_clientId_fkey" TO "briefings_clientId_fkey";

-- RenameForeignKey
ALTER TABLE "campaigns" RENAME CONSTRAINT "Campaign_clientId_fkey" TO "campaigns_clientId_fkey";

-- RenameForeignKey
ALTER TABLE "clients" RENAME CONSTRAINT "Client_agencyId_fkey" TO "clients_agencyId_fkey";

-- RenameForeignKey
ALTER TABLE "clients" RENAME CONSTRAINT "Client_ownerId_fkey" TO "clients_ownerId_fkey";

-- RenameForeignKey
ALTER TABLE "comments" RENAME CONSTRAINT "Comment_postId_fkey" TO "comments_postId_fkey";

-- RenameForeignKey
ALTER TABLE "comments" RENAME CONSTRAINT "Comment_socialAccountId_fkey" TO "comments_socialAccountId_fkey";

-- RenameForeignKey
ALTER TABLE "dm_conversations" RENAME CONSTRAINT "DmConversation_clientId_fkey" TO "dm_conversations_clientId_fkey";

-- RenameForeignKey
ALTER TABLE "dm_messages" RENAME CONSTRAINT "DmMessage_conversationId_fkey" TO "dm_messages_conversationId_fkey";

-- RenameForeignKey
ALTER TABLE "follower_dailies" RENAME CONSTRAINT "FollowerDaily_socialAccountId_fkey" TO "follower_dailies_socialAccountId_fkey";

-- RenameForeignKey
ALTER TABLE "leads" RENAME CONSTRAINT "Lead_clientId_fkey" TO "leads_clientId_fkey";

-- RenameForeignKey
ALTER TABLE "messages" RENAME CONSTRAINT "Message_socialAccountId_fkey" TO "messages_socialAccountId_fkey";

-- RenameForeignKey
ALTER TABLE "notifications" RENAME CONSTRAINT "Notification_userId_fkey" TO "notifications_userId_fkey";

-- RenameForeignKey
ALTER TABLE "post_insights" RENAME CONSTRAINT "PostInsight_postId_fkey" TO "post_insights_postId_fkey";

-- RenameForeignKey
ALTER TABLE "post_metric_dailies" RENAME CONSTRAINT "PostMetricDaily_postId_fkey" TO "post_metric_dailies_postId_fkey";

-- RenameForeignKey
ALTER TABLE "posts" RENAME CONSTRAINT "Post_socialAccountId_fkey" TO "posts_socialAccountId_fkey";

-- RenameForeignKey
ALTER TABLE "pulse_nudge_logs" RENAME CONSTRAINT "PulseNudgeLog_clientId_fkey" TO "pulse_nudge_logs_clientId_fkey";

-- RenameForeignKey
ALTER TABLE "recommendations" RENAME CONSTRAINT "Recommendation_clientId_fkey" TO "recommendations_clientId_fkey";

-- RenameForeignKey
ALTER TABLE "scheduled_posts" RENAME CONSTRAINT "ScheduledPost_clientId_fkey" TO "scheduled_posts_clientId_fkey";

-- RenameForeignKey
ALTER TABLE "scheduled_posts" RENAME CONSTRAINT "ScheduledPost_socialAccountId_fkey" TO "scheduled_posts_socialAccountId_fkey";

-- RenameForeignKey
ALTER TABLE "social_accounts" RENAME CONSTRAINT "SocialAccount_clientId_fkey" TO "social_accounts_clientId_fkey";

-- RenameForeignKey
ALTER TABLE "sync_runs" RENAME CONSTRAINT "SyncRun_clientId_fkey" TO "sync_runs_clientId_fkey";

-- RenameForeignKey
ALTER TABLE "sync_runs" RENAME CONSTRAINT "SyncRun_socialAccountId_fkey" TO "sync_runs_socialAccountId_fkey";

-- RenameForeignKey
ALTER TABLE "users" RENAME CONSTRAINT "User_clientId_fkey" TO "users_clientId_fkey";

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "AiInsight_clientId_idx" RENAME TO "ai_insights_clientId_idx";

-- RenameIndex
ALTER INDEX "AiMonthlyUsage_clientId_idx" RENAME TO "ai_monthly_usages_clientId_idx";

-- RenameIndex
ALTER INDEX "AiMonthlyUsage_clientId_monthKey_key" RENAME TO "ai_monthly_usages_clientId_monthKey_key";

-- RenameIndex
ALTER INDEX "AiUsageLog_clientId_createdAt_idx" RENAME TO "ai_usage_logs_clientId_createdAt_idx";

-- RenameIndex
ALTER INDEX "AiUsageLog_feature_idx" RENAME TO "ai_usage_logs_feature_idx";

-- RenameIndex
ALTER INDEX "BriefingFeedback_briefingId_idx" RENAME TO "briefing_feedbacks_briefingId_idx";

-- RenameIndex
ALTER INDEX "Briefing_clientId_idx" RENAME TO "briefings_clientId_idx";

-- RenameIndex
ALTER INDEX "Briefing_clientId_sentAt_idx" RENAME TO "briefings_clientId_sentAt_idx";

-- RenameIndex
ALTER INDEX "Comment_socialAccountId_platformCommentId_key" RENAME TO "comments_socialAccountId_platformCommentId_key";

-- RenameIndex
ALTER INDEX "DmConversation_clientId_instagramUserId_idx" RENAME TO "dm_conversations_clientId_instagramUserId_idx";

-- RenameIndex
ALTER INDEX "DmConversation_clientId_instagramUserId_key" RENAME TO "dm_conversations_clientId_instagramUserId_key";

-- RenameIndex
ALTER INDEX "DmMessage_conversationId_idx" RENAME TO "dm_messages_conversationId_idx";

-- RenameIndex
ALTER INDEX "EmailLog_deduplicationKey_idx" RENAME TO "email_logs_deduplicationKey_idx";

-- RenameIndex
ALTER INDEX "EmailLog_deduplicationKey_key" RENAME TO "email_logs_deduplicationKey_key";

-- RenameIndex
ALTER INDEX "EmailLog_emailType_idx" RENAME TO "email_logs_emailType_idx";

-- RenameIndex
ALTER INDEX "EmailLog_status_idx" RENAME TO "email_logs_status_idx";

-- RenameIndex
ALTER INDEX "EmailLog_toAddress_idx" RENAME TO "email_logs_toAddress_idx";

-- RenameIndex
ALTER INDEX "EmailLog_userId_idx" RENAME TO "email_logs_userId_idx";

-- RenameIndex
ALTER INDEX "EmailSuppression_email_key" RENAME TO "email_suppressions_email_key";

-- RenameIndex
ALTER INDEX "FollowerDaily_socialAccountId_date_key" RENAME TO "follower_dailies_socialAccountId_date_key";

-- RenameIndex
ALTER INDEX "FollowerDaily_socialAccountId_idx" RENAME TO "follower_dailies_socialAccountId_idx";

-- RenameIndex
ALTER INDEX "JobLog_createdAt_idx" RENAME TO "job_logs_createdAt_idx";

-- RenameIndex
ALTER INDEX "JobLog_queue_jobId_key" RENAME TO "job_logs_queue_jobId_key";

-- RenameIndex
ALTER INDEX "JobLog_queue_status_idx" RENAME TO "job_logs_queue_status_idx";

-- RenameIndex
ALTER INDEX "Lead_clientId_source_sourceId_key" RENAME TO "leads_clientId_source_sourceId_key";

-- RenameIndex
ALTER INDEX "Message_socialAccountId_platformMessageId_key" RENAME TO "messages_socialAccountId_platformMessageId_key";

-- RenameIndex
ALTER INDEX "Notification_userId_createdAt_idx" RENAME TO "notifications_userId_createdAt_idx";

-- RenameIndex
ALTER INDEX "Notification_userId_read_createdAt_idx" RENAME TO "notifications_userId_read_createdAt_idx";

-- RenameIndex
ALTER INDEX "PostMetricDaily_postId_date_key" RENAME TO "post_metric_dailies_postId_date_key";

-- RenameIndex
ALTER INDEX "Post_socialAccountId_platformPostId_key" RENAME TO "posts_socialAccountId_platformPostId_key";

-- RenameIndex
ALTER INDEX "PulseNudgeLog_clientId_nudgeKey_createdAt_idx" RENAME TO "pulse_nudge_logs_clientId_nudgeKey_createdAt_idx";

-- RenameIndex
ALTER INDEX "ScheduledPost_clientId_idx" RENAME TO "scheduled_posts_clientId_idx";

-- RenameIndex
ALTER INDEX "ScheduledPost_socialAccountId_idx" RENAME TO "scheduled_posts_socialAccountId_idx";

-- RenameIndex
ALTER INDEX "ScheduledPost_status_idx" RENAME TO "scheduled_posts_status_idx";

-- RenameIndex
ALTER INDEX "SocialAccount_platform_platformUserId_key" RENAME TO "social_accounts_platform_platformUserId_key";

-- RenameIndex
ALTER INDEX "SystemEvent_category_createdAt_idx" RENAME TO "system_events_category_createdAt_idx";

-- RenameIndex
ALTER INDEX "SystemEvent_createdAt_idx" RENAME TO "system_events_createdAt_idx";

-- RenameIndex
ALTER INDEX "User_email_key" RENAME TO "users_email_key";
