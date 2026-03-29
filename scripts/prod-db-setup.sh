#!/usr/bin/env bash
# Run this locally with your Supabase DATABASE_URL
# Usage: bash scripts/prod-db-setup.sh "postgresql://..."
set -euo pipefail

if [ "${1:-}" = "" ]; then
  echo "Usage: bash scripts/prod-db-setup.sh \"postgresql://user:pass@host:5432/postgres\"" >&2
  exit 1
fi

export DATABASE_URL="$1"

echo "▶ Running migrations..."
npx prisma migrate deploy

echo "▶ Seeding database..."
npx prisma db seed

echo "✅ Done. Now test login at https://social-media-controller.vercel.app/login"
echo "   Email: demo@demo.com | Password: Demo1234!"
