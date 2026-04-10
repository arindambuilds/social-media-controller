# 🚨 DISASTER RECOVERY PLAN

**Last Updated:** April 10, 2026  
**Owner:** Engineering Team  
**Review Frequency:** Quarterly

---

## 📋 QUICK REFERENCE

### Emergency Contacts:
- **Database Admin**: [Your email]
- **Supabase Support**: https://supabase.com/dashboard/support
- **Render Support**: https://render.com/docs/support

### Critical URLs:
- **Supabase Dashboard**: https://app.supabase.com
- **Render Dashboard**: https://dashboard.render.com
- **Production App**: https://your-app.onrender.com

---

## 🔄 DATABASE RESTORATION PROCEDURES

### Scenario 1: Point-in-Time Recovery (PITR)

**When to use**: Accidental data deletion, corrupted records within last 7 days

**Steps:**

1. **Identify Recovery Point**
   - Determine exact timestamp BEFORE the incident
   - Example: Data deleted at 2:30 PM → restore to 2:25 PM

2. **Access Supabase Dashboard**
   ```
   1. Go to https://app.supabase.com
   2. Select your project
   3. Click Settings → Database → Backups
   4. Click "Point in Time Recovery" tab
   ```

3. **Initiate Restore**
   ```
   1. Select recovery timestamp
   2. Choose "Restore to new project" (RECOMMENDED)
      - This creates a new database instance
      - Original database stays untouched
      - You can compare data before switching
   3. Click "Start Recovery"
   4. Wait 5-15 minutes (depending on database size)
   ```

4. **Verify Restored Data**
   ```bash
   # Connect to restored database
   export NEW_DB_URL="<new_database_url_from_supabase>"
   
   # Check critical tables
   psql "$NEW_DB_URL" -c "SELECT COUNT(*) FROM users;"
   psql "$NEW_DB_URL" -c "SELECT COUNT(*) FROM clients;"
   
   # Verify specific data is present
   psql "$NEW_DB_URL" -c "SELECT * FROM clients WHERE id = 'affected_client_id';"
   ```

5. **Switch Production to Restored Database**
   ```
   1. Go to Render Dashboard
   2. Select your service
   3. Environment → Edit DATABASE_URL
   4. Replace with new database connection string
   5. Save changes
   6. Service will auto-restart
   ```

6. **Verify Application Works**
   ```bash
   # Test health endpoint
   curl https://your-app.onrender.com/api/health
   
   # Test authenticated request
   curl https://your-app.onrender.com/api/clients \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

**Recovery Time Objective (RTO)**: 20 minutes  
**Recovery Point Objective (RPO)**: < 5 minutes (PITR precision)

---

### Scenario 2: Daily Backup Restoration

**When to use**: Data loss beyond PITR window, complete database corruption

**Steps:**

1. **Download Latest Backup**
   ```
   1. Go to Supabase Dashboard → Database → Backups
   2. Find latest daily backup (should be < 24 hours old)
   3. Click "Download"
   4. Save as backup.sql
   ```

2. **Restore Locally First (TEST)**
   ```bash
   # Create local test database
   createdb test_restore
   
   # Restore backup
   psql test_restore < backup.sql
   
   # Verify data
   psql test_restore -c "SELECT COUNT(*) FROM users;"
   psql test_restore -c "SELECT COUNT(*) FROM clients;"
   
   # If counts match expected values, proceed to production
   ```

3. **Restore to Production**
   ```bash
   # ⚠️ WARNING: This will overwrite existing data!
   # Make sure you have current backup before proceeding
   
   # Option A: Restore to existing database (DESTRUCTIVE)
   psql "$DIRECT_URL" < backup.sql
   
   # Option B: Create new database and restore (SAFER)
   # 1. Create new Supabase project
   # 2. Get new DATABASE_URL
   # 3. Restore to new database
   psql "$NEW_DATABASE_URL" < backup.sql
   # 4. Update Render environment variable
   ```

4. **Run Migrations**
   ```bash
   # If backup is from older version, run pending migrations
   npx prisma migrate deploy
   ```

5. **Verify Application**
   ```bash
   # Test API endpoints
   npm run smoke:test
   
   # Check critical flows
   # - User login
   # - Dashboard load
   # - Data display
   ```

**Recovery Time Objective (RTO)**: 1 hour  
**Recovery Point Objective (RPO)**: 24 hours (daily backup)

---

### Scenario 3: Complete Database Loss

**When to use**: Supabase project deleted, catastrophic failure

**Steps:**

1. **Create New Supabase Project**
   ```
   1. Go to https://app.supabase.com
   2. Click "New Project"
   3. Choose same region as original
   4. Name it: "[Original Name] - Restored"
   5. Wait for provisioning (2-5 minutes)
   ```

2. **Get Connection Strings**
   ```
   1. Go to Settings → Database
   2. Copy "Connection string" (port 6543) → DATABASE_URL
   3. Copy "Direct connection" (port 5432) → DIRECT_URL
   ```

3. **Restore from Backup**
   ```bash
   # Use latest downloaded backup
   psql "$NEW_DIRECT_URL" < backup.sql
   
   # Run any pending migrations
   export DATABASE_URL="$NEW_DATABASE_URL"
   export DIRECT_URL="$NEW_DIRECT_URL"
   npx prisma migrate deploy
   ```

4. **Update All Environment Variables**
   ```
   Render:
   - DATABASE_URL (pooled, port 6543)
   - DIRECT_URL (direct, port 5432)
   
   Local development:
   - Update .env file
   - Restart dev server
   ```

5. **Re-enable RLS Policies**
   ```bash
   # Run the RLS policies script
   psql "$NEW_DIRECT_URL" < SUPABASE_RLS_POLICIES.sql
   ```

6. **Verify and Monitor**
   ```bash
   # Check application health
   curl https://your-app.onrender.com/api/health
   
   # Monitor Supabase dashboard for connection count
   # Monitor Render logs for errors
   ```

7. **Re-sync Recent Data**
   ```
   If backup is > 24 hours old:
   - Instagram data: Re-trigger sync for all social accounts
   - WhatsApp: Recent messages should arrive via webhook
   - Briefings: May need to regenerate for missed days
   ```

**Recovery Time Objective (RTO)**: 2 hours  
**Recovery Point Objective (RPO)**: 24 hours + manual re-sync time

---

## 🧪 DATA LOSS SCENARIOS & SOLUTIONS

### Accidental DELETE Query

**Example**: `DELETE FROM leads WHERE status = 'NEW'` ran without WHERE clause

**Solution**: PITR to 1 minute before DELETE command

**Prevention**:
- Always use transactions in production
- Use soft deletes (`deletedAt` field)
- Require manual confirmation for bulk deletes

---

### Corrupted Data from Bug

**Example**: Bug in code sets all client names to "undefined"

**Solution**: 
1. PITR to before bug deployed
2. Extract correct data: `SELECT id, name FROM clients;`
3. Apply fixes to current database
4. OR restore entire database if corruption is widespread

**Prevention**:
- Staging environment testing
- Database constraints (NOT NULL, CHECK)
- Code review for DB writes

---

### Schema Migration Failure

**Example**: Migration ran partially, left database in inconsistent state

**Solution**:
1. Check `_prisma_migrations` table for failed migration
2. If recent: PITR to before migration
3. If not: Manually fix schema issues
4. Re-run migration

**Prevention**:
- Test migrations in staging first
- Use `npx prisma migrate deploy` (doesn't auto-apply)
- Keep migration rollback scripts

---

## 📊 MONITORING & ALERTS

### Database Health Checks

**Daily Manual Checks:**
- [ ] Supabase Dashboard → Database → Connection pooling (should be < 80%)
- [ ] Supabase Dashboard → Database → Size (monitor growth)
- [ ] Latest backup timestamp (should be < 24 hours)

**Automated Monitoring** (to implement):
```bash
# Run this weekly via cron
./scripts/verify-backup.sh

# Set up alerts for:
# - Backup age > 25 hours
# - Connection pool > 90% utilization
# - Database size > 8GB (adjust for your plan)
```

---

## 🎯 PREVENTION CHECKLIST

### Daily:
- [ ] Monitor error rates in Sentry
- [ ] Check Render deployment logs
- [ ] Verify backups are running

### Weekly:
- [ ] Run `./scripts/verify-backup.sh`
- [ ] Download and inspect backup file
- [ ] Review database size and growth

### Monthly:
- [ ] Test backup restoration procedure
- [ ] Review and update this document
- [ ] Verify RLS policies are working

### Quarterly:
- [ ] Full disaster recovery drill
- [ ] Review and test all scenarios
- [ ] Update team on procedures

---

## 🔐 SECURITY DURING RECOVERY

### Access Control:
- Only authorized personnel can restore databases
- All backup downloads must be logged
- Restored databases must have RLS re-enabled immediately

### Data Handling:
- Never store backups in public locations
- Encrypt backup files at rest
- Delete local backup copies after restoration

---

## 📞 ESCALATION PROCEDURES

### If You Can't Restore:

1. **Contact Supabase Support** (for database issues)
   - Email: support@supabase.com
   - Dashboard: https://supabase.com/dashboard/support
   - Include: Project ID, timestamp of incident, error messages

2. **Contact Render Support** (for deployment issues)
   - Email: support@render.com
   - Dashboard: https://dashboard.render.com/support
   - Include: Service ID, deployment logs, error messages

3. **Emergency Contacts**
   - Database Admin: [Your email]
   - CTO/Lead Engineer: [Email]
   - Backup contact: [Email]

---

## 📝 POST-INCIDENT CHECKLIST

After any recovery:

- [ ] Document what happened (incident report)
- [ ] Document what was done to recover
- [ ] Calculate actual RTO and RPO
- [ ] Identify root cause
- [ ] Implement prevention measures
- [ ] Update this document with lessons learned
- [ ] Communicate to stakeholders

---

## 🧰 USEFUL COMMANDS

### Database Inspection:
```bash
# List all tables
psql "$DIRECT_URL" -c "\dt"

# Check table row counts
psql "$DIRECT_URL" -c "
SELECT 
  schemaname, 
  tablename, 
  n_live_tup 
FROM pg_stat_user_tables 
ORDER BY n_live_tup DESC;
"

# Check database size
psql "$DIRECT_URL" -c "
SELECT 
  pg_size_pretty(pg_database_size(current_database()));
"
```

### Backup Management:
```bash
# Create manual backup
pg_dump "$DIRECT_URL" > manual_backup_$(date +%Y%m%d).sql

# Restore from backup
psql "$DIRECT_URL" < backup.sql

# Restore specific table
pg_restore -t users backup.sql | psql "$DIRECT_URL"
```

---

**Remember**: It's better to restore from backup and lose some data than to risk making things worse with manual fixes!
