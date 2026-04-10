-- =============================================================================
-- SUPABASE ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================
-- Enable RLS on all tables and define policies to ensure users can only
-- access their own data. This provides defense-in-depth beyond application logic.
--
-- HOW TO APPLY:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Copy and paste this entire file
-- 3. Execute (or run section by section)
-- 4. Verify in Table Editor that RLS is enabled with green shield icon
--
-- TESTING:
-- After applying, test with a non-admin user token to ensure they can't
-- query other users' data even with direct database access.
-- =============================================================================

-- =============================================================================
-- USERS TABLE
-- =============================================================================
-- Users can only read/update their own record
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON users
  FOR SELECT
  USING (auth.uid()::text = id);

CREATE POLICY "users_update_own" ON users
  FOR UPDATE
  USING (auth.uid()::text = id);

-- Admin users can access all users (optional - comment out if not needed)
CREATE POLICY "users_admin_all" ON users
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()::text
      AND u.role = 'AGENCY_ADMIN'
    )
  );

-- =============================================================================
-- CLIENTS TABLE
-- =============================================================================
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Users can access their own client
CREATE POLICY "clients_select_own" ON clients
  FOR SELECT
  USING (
    id IN (
      SELECT "clientId" FROM users WHERE id = auth.uid()::text
    )
    OR 
    "ownerId" = auth.uid()::text
  );

-- Agency admins can access all clients they manage
CREATE POLICY "clients_agency_admin" ON clients
  FOR ALL
  USING (
    "agencyId" IN (
      SELECT id FROM users 
      WHERE id = auth.uid()::text 
      AND role = 'AGENCY_ADMIN'
    )
  );

-- =============================================================================
-- SOCIAL ACCOUNTS
-- =============================================================================
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social_accounts_client_access" ON social_accounts
  FOR ALL
  USING (
    "clientId" IN (
      SELECT "clientId" FROM users WHERE id = auth.uid()::text
    )
    OR
    "clientId" IN (
      SELECT id FROM clients WHERE "ownerId" = auth.uid()::text
    )
    OR
    "clientId" IN (
      SELECT id FROM clients WHERE "agencyId" IN (
        SELECT id FROM users WHERE id = auth.uid()::text AND role = 'AGENCY_ADMIN'
      )
    )
  );

-- =============================================================================
-- POSTS
-- =============================================================================
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "posts_via_social_account" ON posts
  FOR ALL
  USING (
    "socialAccountId" IN (
      SELECT id FROM social_accounts sa
      WHERE sa."clientId" IN (
        SELECT "clientId" FROM users WHERE id = auth.uid()::text
      )
    )
  );

-- =============================================================================
-- SCHEDULED POSTS
-- =============================================================================
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scheduled_posts_client_access" ON scheduled_posts
  FOR ALL
  USING (
    "clientId" IN (
      SELECT "clientId" FROM users WHERE id = auth.uid()::text
    )
    OR
    "clientId" IN (
      SELECT id FROM clients WHERE "ownerId" = auth.uid()::text
    )
  );

-- =============================================================================
-- LEADS
-- =============================================================================
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_client_access" ON leads
  FOR ALL
  USING (
    "clientId" IN (
      SELECT "clientId" FROM users WHERE id = auth.uid()::text
    )
  );

-- =============================================================================
-- DM CONVERSATIONS
-- =============================================================================
ALTER TABLE dm_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dm_conversations_client_access" ON dm_conversations
  FOR ALL
  USING (
    "clientId" IN (
      SELECT "clientId" FROM users WHERE id = auth.uid()::text
    )
  );

-- =============================================================================
-- DM MESSAGES
-- =============================================================================
ALTER TABLE dm_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dm_messages_via_conversation" ON dm_messages
  FOR ALL
  USING (
    "conversationId" IN (
      SELECT id FROM dm_conversations dc
      WHERE dc."clientId" IN (
        SELECT "clientId" FROM users WHERE id = auth.uid()::text
      )
    )
  );

-- =============================================================================
-- COMMENTS
-- =============================================================================
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_via_social_account" ON comments
  FOR ALL
  USING (
    "socialAccountId" IN (
      SELECT id FROM social_accounts sa
      WHERE sa."clientId" IN (
        SELECT "clientId" FROM users WHERE id = auth.uid()::text
      )
    )
  );

-- =============================================================================
-- MESSAGES
-- =============================================================================
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_via_social_account" ON messages
  FOR ALL
  USING (
    "socialAccountId" IN (
      SELECT id FROM social_accounts sa
      WHERE sa."clientId" IN (
        SELECT "clientId" FROM users WHERE id = auth.uid()::text
      )
    )
  );

-- =============================================================================
-- CAMPAIGNS
-- =============================================================================
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaigns_client_access" ON campaigns
  FOR ALL
  USING (
    "clientId" IN (
      SELECT "clientId" FROM users WHERE id = auth.uid()::text
    )
  );

-- =============================================================================
-- REPORTS
-- =============================================================================
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_client_access" ON reports
  FOR ALL
  USING (
    "clientId" IN (
      SELECT "clientId" FROM users WHERE id = auth.uid()::text
    )
    OR
    "userId" = auth.uid()::text
  );

-- =============================================================================
-- BRIEFINGS
-- =============================================================================
ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "briefings_client_access" ON briefings
  FOR ALL
  USING (
    "clientId" IN (
      SELECT "clientId" FROM users WHERE id = auth.uid()::text
    )
  );

-- =============================================================================
-- NOTIFICATIONS
-- =============================================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_own_only" ON notifications
  FOR ALL
  USING ("userId" = auth.uid()::text);

-- =============================================================================
-- AI INSIGHTS
-- =============================================================================
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_insights_client_access" ON ai_insights
  FOR ALL
  USING (
    "clientId" IN (
      SELECT "clientId" FROM users WHERE id = auth.uid()::text
    )
  );

-- =============================================================================
-- RECOMMENDATIONS
-- =============================================================================
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recommendations_client_access" ON recommendations
  FOR ALL
  USING (
    "clientId" IN (
      SELECT "clientId" FROM users WHERE id = auth.uid()::text
    )
  );

-- =============================================================================
-- AUDIT LOGS
-- =============================================================================
-- Audit logs should be read-only for regular users, writable by system
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_read_own_client" ON audit_logs
  FOR SELECT
  USING (
    "clientId" IN (
      SELECT "clientId" FROM users WHERE id = auth.uid()::text
    )
  );

-- System can insert (handled by service account)
-- No UPDATE or DELETE allowed for users

-- =============================================================================
-- EMAIL LOGS
-- =============================================================================
-- Email logs are system-managed, users can only read their own
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_logs_read_own" ON email_logs
  FOR SELECT
  USING (
    "userId" = auth.uid()::text
    OR
    "toAddress" IN (
      SELECT email FROM users WHERE id = auth.uid()::text
    )
  );

-- =============================================================================
-- FOLLOWER DAILIES
-- =============================================================================
ALTER TABLE follower_dailies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "follower_dailies_via_social_account" ON follower_dailies
  FOR ALL
  USING (
    "socialAccountId" IN (
      SELECT id FROM social_accounts sa
      WHERE sa."clientId" IN (
        SELECT "clientId" FROM users WHERE id = auth.uid()::text
      )
    )
  );

-- =============================================================================
-- SYNC RUNS
-- =============================================================================
ALTER TABLE sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_runs_client_access" ON sync_runs
  FOR ALL
  USING (
    "clientId" IN (
      SELECT "clientId" FROM users WHERE id = auth.uid()::text
    )
  );

-- =============================================================================
-- POST INSIGHTS & METRICS
-- =============================================================================
ALTER TABLE post_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_insights_via_post" ON post_insights
  FOR ALL
  USING (
    "postId" IN (
      SELECT p.id FROM posts p
      JOIN social_accounts sa ON p."socialAccountId" = sa.id
      WHERE sa."clientId" IN (
        SELECT "clientId" FROM users WHERE id = auth.uid()::text
      )
    )
  );

ALTER TABLE post_metric_dailies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_metric_dailies_via_post" ON post_metric_dailies
  FOR ALL
  USING (
    "postId" IN (
      SELECT p.id FROM posts p
      JOIN social_accounts sa ON p."socialAccountId" = sa.id
      WHERE sa."clientId" IN (
        SELECT "clientId" FROM users WHERE id = auth.uid()::text
      )
    )
  );

-- =============================================================================
-- JOB LOGS
-- =============================================================================
-- Read-only for users (if they need to see background job status)
ALTER TABLE job_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_logs_read_only" ON job_logs
  FOR SELECT
  USING (true); -- Adjust if you want to restrict this

-- =============================================================================
-- ANALYTICS EVENTS
-- =============================================================================
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analytics_events_own_only" ON analytics_events
  FOR ALL
  USING ("userId" = auth.uid()::text OR "userId" IS NULL);

-- =============================================================================
-- AI USAGE LOGS & MONTHLY USAGE
-- =============================================================================
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_usage_logs_client_access" ON ai_usage_logs
  FOR SELECT
  USING (
    "clientId" IN (
      SELECT "clientId" FROM users WHERE id = auth.uid()::text
    )
  );

ALTER TABLE ai_monthly_usages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_monthly_usages_client_access" ON ai_monthly_usages
  FOR SELECT
  USING (
    "clientId" IN (
      SELECT "clientId" FROM users WHERE id = auth.uid()::text
    )
  );

-- =============================================================================
-- SYSTEM EVENTS
-- =============================================================================
-- Admin-only access
ALTER TABLE system_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_events_admin_only" ON system_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()::text
      AND role = 'AGENCY_ADMIN'
    )
  );

-- =============================================================================
-- DEMO DATA
-- =============================================================================
ALTER TABLE "DemoData" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demo_data_own_only" ON "DemoData"
  FOR ALL
  USING ("userId" = auth.uid()::text);

-- =============================================================================
-- VERIFICATION
-- =============================================================================
-- Run this query to verify RLS is enabled on all tables:
/*
SELECT 
  schemaname, 
  tablename, 
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename NOT LIKE 'pg_%'
AND tablename NOT LIKE '_prisma%'
ORDER BY tablename;

-- All tables should show rowsecurity = true
*/

-- =============================================================================
-- TESTING RLS
-- =============================================================================
-- To test that RLS is working:
-- 1. Create a test user and get their JWT token
-- 2. Set the user context: SET LOCAL auth.uid = '<user-id>';
-- 3. Try to query another user's data
-- 4. You should get 0 results if RLS is working correctly

-- Example test:
/*
-- As user A, try to access user B's data:
SET LOCAL auth.uid = 'user-a-id';
SELECT * FROM clients WHERE id = 'user-b-client-id';
-- Should return 0 rows

-- Reset:
RESET auth.uid;
*/
