#!/usr/bin/env bash
# Run in Render Shell (or any shell with production DATABASE_URL in the environment).
set -euo pipefail

echo "==> prod-setup: prisma migrate deploy"
npx prisma migrate deploy

echo "==> prod-setup: prisma db seed"
npx prisma db seed

echo "==> prod-setup: done"
