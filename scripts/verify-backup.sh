#!/bin/bash
# =============================================================================
# Backup Verification Script
# =============================================================================
# Purpose: Verify Supabase backups are working correctly
# Schedule: Run weekly (recommended)
# Usage: ./scripts/verify-backup.sh
# =============================================================================

set -e

echo "🔍 Verifying Supabase Backups..."
echo ""

# Check if DIRECT_URL is set
if [ -z "$DIRECT_URL" ]; then
  echo "❌ DIRECT_URL environment variable not set"
  echo "   Set it in your shell: export DIRECT_URL='your_connection_string'"
  exit 1
fi

# Test database connection
echo "📡 Testing database connection..."
if psql "$DIRECT_URL" -c "SELECT 1;" > /dev/null 2>&1; then
  echo "✅ Database connection successful"
else
  echo "❌ Database connection failed"
  echo "   Check your DIRECT_URL connection string"
  exit 1
fi

echo ""
echo "📊 Checking critical tables..."

# Count records in critical tables
USER_COUNT=$(psql "$DIRECT_URL" -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
CLIENT_COUNT=$(psql "$DIRECT_URL" -t -c "SELECT COUNT(*) FROM clients;" 2>/dev/null || echo "0")
POST_COUNT=$(psql "$DIRECT_URL" -t -c "SELECT COUNT(*) FROM posts;" 2>/dev/null || echo "0")
BRIEFING_COUNT=$(psql "$DIRECT_URL" -t -c "SELECT COUNT(*) FROM briefings;" 2>/dev/null || echo "0")

echo "   Users: $USER_COUNT"
echo "   Clients: $CLIENT_COUNT"
echo "   Posts: $POST_COUNT"
echo "   Briefings: $BRIEFING_COUNT"

echo ""
echo "✅ Backup verification complete"
echo ""
echo "⚠️  Manual Checks Required:"
echo "   1. Go to Supabase Dashboard → Database → Backups"
echo "   2. Verify latest backup date is within 24 hours"
echo "   3. Check PITR is enabled (if on paid plan)"
echo "   4. Download a backup and verify the .sql file"
echo ""
echo "📝 Record these counts for comparison after restoration"
