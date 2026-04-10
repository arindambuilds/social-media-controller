# PulseOS — Tomorrow Morning Checklist
**Prepared:** April 11, 2026

---

## What Was Fixed Tonight

### Redis / BullMQ resilience (25 files changed)
- All 12 BullMQ workers now use `stalledInterval: 60000, lockDuration: 60000, lockRenewTime: 30000, drainDelay: 10` — halves Redis polling frequency vs previous defaults
- All 11 queues now have `defaultJobOptions: { removeOnComplete: 50, removeOnFail: 20 }` — prevents Redis memory bloat from completed/failed job accumulation
- `src/lib/redis.ts` — added `retryStrategy` that caps reconnect delay at 30s (handles Upstash "max requests exceeded" without crashing workers), plus explicit log warning when free-tier limit is hit
- Rate limiter already had `passOnStoreError: true` on all 7 limiters — confirmed fail-open behavior is in place

### Bug fixes (from earlier sessions)
- `src/app.ts` — fixed double-mounted `pulseGovPreviewRouter`, added missing `dashboardRouter` (was causing `GET /api/dashboard/stats` to 404 in production)
- `src/routes/campaigns.ts` — new CRUD API for campaigns (GET/POST/PATCH/DELETE)
- `dashboard/app/campaigns/page.tsx` — replaced hardcoded demo data with real API calls
- `dashboard/pages/api/analytics/funnel.ts` — fixed invalid Prisma import (was breaking dashboard build)
- `dashboard/app/dashboard/page.tsx` — fixed 3 TypeScript errors (missing X import, type mismatch, OnboardingWizard props)
- `dashboard/app/settings/page.tsx` — fixed syntax error (missing template literal backticks), added null guard
- `dashboard/context/auth-context.tsx` — added `onboardingCompleted` to AuthUser type
- `dashboard/tsconfig.json` — excluded `scripts/` from build
- `vitest.config.ts` — added `@/` path alias (was causing 10 test files to fail)
- `src/config/env.ts` — fixed `OPENAI_MODEL` default from `gpt-5` → `gpt-4o`
- `src/lib/demo-cleaner.ts`, `src/lib/demo-seeder.ts` — replaced `console.log` with structured `logger`
- `scripts/create-demo-user.ts` — safe upsert script for demo user (already run against production Supabase)
- npm audit — fixed 4 root vulnerabilities (axios critical, basic-ftp high, vite high, nodemailer moderate)

---

## Manual Actions Required Tomorrow Morning

### 1. Upgrade Upstash to Pay-as-you-go
**URL:** https://console.upstash.com  
Go to your Redis database → Billing → Upgrade to Pay-as-you-go  
This removes the 500k requests/day cap. Cost: ~$0.20 per 100k requests above free tier.  
**This is the most critical action — nothing works until this is done.**

### 2. Upgrade Render to Starter plan ($7/mo)
**URL:** https://render.com → your `social-media-controller` service → Settings → Change Plan  
Starter eliminates the free-tier sleep (52% uptime → 100% uptime).  
If you see OOM restarts after upgrading, move to Standard ($25/mo) — the workers compete for RAM.

### 3. Fix Render DATABASE_URL (CRITICAL — backend currently has database: "error")
The production backend cannot reach Supabase. Go to:  
**Render Dashboard → social-media-controller → Environment**  
Set these exactly (copy-paste, do not retype):
```
DATABASE_URL = postgresql://postgres:Arindam%4029%23%23%23%24%24%25%25@db.lvlzugnoavgzwzulnnyf.supabase.co:6543/postgres?pgbouncer=true&sslmode=require
DIRECT_URL   = postgresql://postgres:Arindam%4029%23%23%23%24%24%25%25@db.lvlzugnoavgzwzulnnyf.supabase.co:5432/postgres?schema=public&sslmode=require
```
Also confirm these are set:
```
JWT_SECRET         = 1cbfec1e870c484964f36d420b2f18003f380f1ceb017b0a37845e71bdf15cb5
JWT_REFRESH_SECRET = e91776f5807b828ab93c7484a4bb49fa9fb54f458b7569a512d7be6793917e4b
ENCRYPTION_KEY     = 9abfd48982bb0c1e762d7ca0854c03e1
CORS_ORIGIN        = https://social-media-controller.vercel.app
```

### 4. Test demo login at the Vercel frontend
**URL:** https://social-media-controller.vercel.app/login  
Credentials:
- Email: `demo@demo.com`
- Password: `Demo1234!`

The demo user is already seeded in Supabase (confirmed). Login will work once DATABASE_URL is fixed on Render.

### 5. Rotate all secrets in .env
The following real credentials are in your local `.env` and should be rotated since they've been visible in this session:
- OpenAI API key (`sk-svcacct-...`)
- WhatsApp access token (`EAATw4faj2vA...`)
- Supabase service role key (`eyJhbGci...`)
- Instagram app secret (`075606485e61d258...`)
- Facebook app secret (`210a2333d46f054f...`)
- Anthropic API key (`sk-ant-api03-uon0Vh76...`)
- JWT secrets and encryption key

Generate new ones from each provider's dashboard and update both `.env` (local) and Render environment variables.

### 6. Fix remaining Next.js vulnerability
```bash
cd dashboard && npm audit fix --force
```
This upgrades Next.js to 15.5.15 (fixes high-severity DoS CVE). Test the dashboard build after:
```bash
npm run build
```

### 7. Verify UptimeRobot shows green after Upstash upgrade
Check that `/health` returns `database: "ok"` and `redis: "ok"`:
```
https://social-media-controller.onrender.com/health
```
Expected after all fixes:
```json
{"status":"ok","server":"ok","database":"ok","redis":"ok"}
```

---

## Current Status of PulseOS

| Feature | Status | Reason |
|---------|--------|--------|
| Backend server | ✅ Running | Render free tier, sleeps after 15min |
| Database connection | ❌ Broken | Render DATABASE_URL not set correctly |
| Redis / BullMQ | ❌ Rate limited | Upstash free tier 500k/day exhausted |
| Demo login | ❌ Failing | Cascades from database error |
| WhatsApp DMs | ❌ Failing | Redis rate limit + DB error |
| Morning briefings | ❌ Failing | Redis rate limit |
| Dashboard build | ✅ Passes | Zero TypeScript errors |
| Unit tests | ✅ 115/115 pass | Integration tests need local Postgres |
| Campaigns page | ✅ Built | Real API wired |
| PDF reports | ✅ Code ready | Needs DB + Redis to function |
| Instagram OAuth | ✅ Configured | Needs DB to function |

---

## Next Development Priorities (after fixes confirmed)

1. **Seed full demo data** — run `npx tsx prisma/seed.ts` against production to populate Aroma Silk House posts, leads, conversations, and AI insights for the IAS demo
2. **Manual UI verification pass** — walk through every page on the live Vercel URL and note any broken states
3. **Render DATABASE_URL root cause** — investigate why the variable isn't being picked up (may need to redeploy after setting, or check for trailing spaces in the Render dashboard)
4. **WhatsApp webhook verification** — confirm Meta webhook is pointing to the correct Render URL after plan upgrade
5. **Startup Odisha demo prep** — run `npm run smoke:render` to verify all critical paths work end-to-end
6. **Delete `social-media-controller/` nested clone** — it's in `.gitignore` but takes up disk space
7. **ESLint config** — add `eslint-config-next` to dashboard to fix the build warning about missing Next.js plugin

---

Good night. Everything is committed and pushed. The code is ready — just needs the infrastructure fixes tomorrow morning.
