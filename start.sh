#!/bin/bash
set -e
echo "Running migrations..."
npx prisma migrate deploy
echo "Seeding database..."
npx tsx prisma/seed.ts
echo "Starting server..."
npm run start
