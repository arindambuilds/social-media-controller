#!/usr/bin/env bash
# Run in Render Shell (or any shell with production DATABASE_URL in the environment).
# The API `npm start` / Docker CMD also runs `prisma migrate deploy` before boot so new migrations apply automatically.
set -euo pipefail

echo "==> prod-setup: prisma migrate deploy"
npx prisma migrate deploy

echo "==> prod-setup: prisma db seed"
npx prisma db seed

echo "==> prod-setup: done"
