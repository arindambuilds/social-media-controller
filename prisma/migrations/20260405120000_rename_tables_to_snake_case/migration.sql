-- Align physical table names with Prisma @@map("snake_case") targets.
-- Idempotent: skips if target already exists or source is missing.

DO $$
BEGIN
  IF to_regclass('public."User"') IS NOT NULL AND to_regclass('public.users') IS NULL THEN
    ALTER TABLE "User" RENAME TO users;
  END IF;
  IF to_regclass('public."Notification"') IS NOT NULL AND to_regclass('public.notifications') IS NULL THEN
    ALTER TABLE "Notification" RENAME TO notifications;
  END IF;
  IF to_regclass('public."Client"') IS NOT NULL AND to_regclass('public.clients') IS NULL THEN
    ALTER TABLE "Client" RENAME TO clients;
  END IF;
  IF to_regclass('public."PulseNudgeLog"') IS NOT NULL AND to_regclass('public.pulse_nudge_logs') IS NULL THEN
    ALTER TABLE "PulseNudgeLog" RENAME TO pulse_nudge_logs;
  END IF;
  IF to_regclass('public."DmConversation"') IS NOT NULL AND to_regclass('public.dm_conversations') IS NULL THEN
    ALTER TABLE "DmConversation" RENAME TO dm_conversations;
  END IF;
  IF to_regclass('public."DmMessage"') IS NOT NULL AND to_regclass('public.dm_messages') IS NULL THEN
    ALTER TABLE "DmMessage" RENAME TO dm_messages;
  END IF;
  IF to_regclass('public."Briefing"') IS NOT NULL AND to_regclass('public.briefings') IS NULL THEN
    ALTER TABLE "Briefing" RENAME TO briefings;
  END IF;
  IF to_regclass('public."BriefingFeedback"') IS NOT NULL AND to_regclass('public.briefing_feedbacks') IS NULL THEN
    ALTER TABLE "BriefingFeedback" RENAME TO briefing_feedbacks;
  END IF;
  IF to_regclass('public."AiUsageLog"') IS NOT NULL AND to_regclass('public.ai_usage_logs') IS NULL THEN
    ALTER TABLE "AiUsageLog" RENAME TO ai_usage_logs;
  END IF;
  IF to_regclass('public."SystemEvent"') IS NOT NULL AND to_regclass('public.system_events') IS NULL THEN
    ALTER TABLE "SystemEvent" RENAME TO system_events;
  END IF;
  IF to_regclass('public."SocialAccount"') IS NOT NULL AND to_regclass('public.social_accounts') IS NULL THEN
    ALTER TABLE "SocialAccount" RENAME TO social_accounts;
  END IF;
  IF to_regclass('public."ScheduledPost"') IS NOT NULL AND to_regclass('public.scheduled_posts') IS NULL THEN
    ALTER TABLE "ScheduledPost" RENAME TO scheduled_posts;
  END IF;
  IF to_regclass('public."FollowerDaily"') IS NOT NULL AND to_regclass('public.follower_dailies') IS NULL THEN
    ALTER TABLE "FollowerDaily" RENAME TO follower_dailies;
  END IF;
  IF to_regclass('public."Campaign"') IS NOT NULL AND to_regclass('public.campaigns') IS NULL THEN
    ALTER TABLE "Campaign" RENAME TO campaigns;
  END IF;
  IF to_regclass('public."Post"') IS NOT NULL AND to_regclass('public.posts') IS NULL THEN
    ALTER TABLE "Post" RENAME TO posts;
  END IF;
  IF to_regclass('public."PostInsight"') IS NOT NULL AND to_regclass('public.post_insights') IS NULL THEN
    ALTER TABLE "PostInsight" RENAME TO post_insights;
  END IF;
  IF to_regclass('public."PostMetricDaily"') IS NOT NULL AND to_regclass('public.post_metric_dailies') IS NULL THEN
    ALTER TABLE "PostMetricDaily" RENAME TO post_metric_dailies;
  END IF;
  IF to_regclass('public."Comment"') IS NOT NULL AND to_regclass('public.comments') IS NULL THEN
    ALTER TABLE "Comment" RENAME TO comments;
  END IF;
  IF to_regclass('public."Message"') IS NOT NULL AND to_regclass('public.messages') IS NULL THEN
    ALTER TABLE "Message" RENAME TO messages;
  END IF;
  IF to_regclass('public."Lead"') IS NOT NULL AND to_regclass('public.leads') IS NULL THEN
    ALTER TABLE "Lead" RENAME TO leads;
  END IF;
  IF to_regclass('public."AuditLog"') IS NOT NULL AND to_regclass('public.audit_logs') IS NULL THEN
    ALTER TABLE "AuditLog" RENAME TO audit_logs;
  END IF;
  IF to_regclass('public."EmailLog"') IS NOT NULL AND to_regclass('public.email_logs') IS NULL THEN
    ALTER TABLE "EmailLog" RENAME TO email_logs;
  END IF;
  IF to_regclass('public."EmailSuppression"') IS NOT NULL AND to_regclass('public.email_suppressions') IS NULL THEN
    ALTER TABLE "EmailSuppression" RENAME TO email_suppressions;
  END IF;
  IF to_regclass('public."SyncRun"') IS NOT NULL AND to_regclass('public.sync_runs') IS NULL THEN
    ALTER TABLE "SyncRun" RENAME TO sync_runs;
  END IF;
  IF to_regclass('public."AiInsight"') IS NOT NULL AND to_regclass('public.ai_insights') IS NULL THEN
    ALTER TABLE "AiInsight" RENAME TO ai_insights;
  END IF;
  IF to_regclass('public."AiMonthlyUsage"') IS NOT NULL AND to_regclass('public.ai_monthly_usages') IS NULL THEN
    ALTER TABLE "AiMonthlyUsage" RENAME TO ai_monthly_usages;
  END IF;
  IF to_regclass('public."Recommendation"') IS NOT NULL AND to_regclass('public.recommendations') IS NULL THEN
    ALTER TABLE "Recommendation" RENAME TO recommendations;
  END IF;
  IF to_regclass('public."JobLog"') IS NOT NULL AND to_regclass('public.job_logs') IS NULL THEN
    ALTER TABLE "JobLog" RENAME TO job_logs;
  END IF;
END $$;
