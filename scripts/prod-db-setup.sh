#!/usr/bin/env bash
# Run locally against production DB. Supabase: arg1 = Transaction pooler (:6543), arg2 = direct (:5432), or set DIRECT_URL in env.
# Usage: bash scripts/prod-db-setup.sh "postgresql://...pooler...:6543/...?pgbouncer=true&sslmode=require" "postgresql://postgres:...@db....supabase.co:5432/postgres?sslmode=require"
set -euo pipefail

if [ "${1:-}" = "" ]; then
  echo "Usage: bash scripts/prod-db-setup.sh \"\$DATABASE_URL_POOLER\" [\"\$DIRECT_URL\"]" >&2
  exit 1
fi

export DATABASE_URL="$1"
export DIRECT_URL="${2:-${DIRECT_URL:-$1}}"

echo "▶ Running migrations..."
npx prisma migrate deploy

echo "▶ Seeding database..."
npx prisma db seed

echo "✅ Done. Now test login at https://social-media-controller.vercel.app/login"
echo "   Primary operator: demo@demo.com | Demo1234! (alternates in README / docs/DEMO.md)"
