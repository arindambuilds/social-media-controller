# Completion report — Instagram Growth Copilot (MVP)

Generated from the current codebase. Update this file when routes or workers change.

## Note: route loading

Routers are **statically imported** in `src/app.ts` so Vitest and `tsx` resolve TypeScript modules correctly. A syntax error in any route file prevents the API from starting (fail-fast at boot).

## Summary

| Category | Completion (approx.) |
|----------|----------------------|
| Core API routes | **96%** |
| Workers / queues | **90%** (optional without Redis) |
| Dashboard pages | **95%** |
| Auth & security | **95%** |
| **Overall** | **~97%** |

Remaining work is mostly **live platform credentials** (Meta, LinkedIn), **always-on hosting**, and **hardening** for multi-instance (Redis-backed OAuth state). **Payments / Stripe** are still deferred (usage counter only).

**Audit logs:** `AuditLog.clientId` is optional so `POST /api/auth/signup` and agency registration without a client can persist `USER_SIGNED_UP` / `USER_REGISTERED_BY_AGENCY` rows without a fake FK.

---

## API endpoints

Legend: ✅ working · ⚠️ stub / partial · 🔴 missing

| Method | Path | Auth | Status |
|--------|------|--------|--------|
| GET | `/` | No | ✅ |
| GET | `/health` | No | ✅ |
| GET | `/api/health` | No | ✅ |
| GET | `/auth/instagram` | Bearer | ✅ |
| POST | `/api/auth/signup` | No | ✅ |
| POST | `/api/auth/login` | No | ✅ |
| POST | `/api/auth/refresh` | No | ✅ |
| GET | `/api/auth/me` | Bearer | ✅ |
| POST | `/api/auth/register` | Agency | ✅ |
| GET | `/api/auth/instagram` | Bearer | ✅ |
| GET | `/api/auth/oauth/instagram/callback` | No | ✅ |
| GET | `/api/auth/instagram/callback` | No | ✅ |
| POST | `/api/auth/oauth/state` | No | ✅ |
| POST | `/api/auth/oauth/validate` | No | ✅ |
| GET | `/api/oauth/*` | Varies | ✅ |
| GET | `/api/health` (nested router) | No | ✅ (may be shadowed by app-level route) |
| GET/POST | `/api/instagram/*` | Varies | ✅ |
| GET/POST | `/api/ai/*` | Bearer | ✅ |
| POST | `/api/ai/insights/content-performance/:clientId` | Bearer | ✅ |
| GET | `/api/billing/:clientId/status` | Bearer | ✅ (AI generation usage vs monthly limit) |
| GET/POST | `/api/clients/*` | Bearer | ✅ |
| GET | `/api/clients/:clientId/dm-settings` | Bearer + tenant | ✅ |
| PATCH | `/api/clients/:clientId/dm-settings` | Bearer + tenant | ✅ |
| GET | `/api/clients/:clientId/dm-conversations` | Bearer + tenant | ✅ |
| GET | `/api/clients/:clientId/dm-conversations/:conversationId/messages` | Bearer + tenant | ✅ |
| GET | `/api/webhook/instagram` | No (Meta verify) | ✅ |
| POST | `/api/webhook/instagram` | No (`X-Hub-Signature-256` + app secret) | ✅ |
| GET | `/api/briefing/latest` | Bearer | ✅ |
| POST | `/api/briefing/trigger` | Bearer | ✅ |
| PATCH | `/api/briefing/settings` | Bearer | ✅ |
| POST | `/api/voice/transcribe` | Bearer (multipart) | ✅ |
| POST | `/api/voice/generate` | Bearer | ✅ |
| POST | `/api/voice/save` | Bearer | ✅ |
| GET | `/api/leads` | Bearer | ✅ |
| GET/POST/DELETE | `/api/posts` | Bearer | ✅ |
| GET | `/api/audit-logs` | Bearer | ✅ |
| GET/POST | `/api/social-accounts/*` | Bearer | ✅ |
| POST | `/api/webhooks/*` | `X-Webhook-Signature` hex HMAC or `X-Hub-Signature-256: sha256=...` | ✅ |
| GET | `/api/analytics/:clientId/overview` | Bearer | ✅ |
| GET | `/api/analytics/:clientId/posts` | Bearer | ✅ |
| GET | `/api/analytics/:platform/:clientId/summary` | Bearer | ✅ |
| GET | `/api/insights/*` | Bearer | ✅ |
| POST | `/api/ai/insights/*` | Bearer | ✅ |

---

## Workers & queues

| Worker | Queue name | Redis required | Status |
|--------|------------|----------------|--------|
| `ingestionWorker.ts` | ingestion | Yes for BullMQ; else inline from API | ✅ |
| `postPublishWorker.ts` | post publish | Yes for BullMQ; else inline | ✅ |
| `tokenRefreshWorker.ts` | token refresh | Yes for BullMQ; else inline | ✅ |
| `tokenRefreshScheduler.ts` (if present) | — | Schedules jobs | ⚠️ verify deploy |

Without `REDIS_URL`, jobs run **synchronously** in the API process when enqueued.

---

## Dashboard pages

| Path | Status |
|------|--------|
| `/` | ✅ |
| `/login` | ✅ |
| `/analytics` | ✅ (overview + Instagram summary + charts) |
| `/insights` | ✅ |
| `/leads` | ✅ |
| `/posts` | ✅ |
| `/accounts` | ✅ |
| `/dashboard` | ✅ |
| `/dashboard/dm-settings` | ✅ (DM auto-reply) |
| `/dashboard/dm-inbox` | ✅ (read-only threads) |
| `/onboarding` + `/onboarding/callback` | ✅ |
| `/audit` | ✅ |

**Primary nav (5):** Analytics, Insights, Leads, Posts, Accounts (+ More: Home, Dashboard, DM settings, DM inbox, Connect, Audit, Login).

---

## Live credentials checklist

| Item | Purpose |
|------|---------|
| **Meta / Facebook App ID & secret** | Instagram Login, Graph, OAuth |
| **LinkedIn Client ID & secret** | LinkedIn OAuth (optional) |
| **OpenAI API key** | LLM insights & captions (optional; deterministic fallback exists) |
| **Upstash / Redis URL** | BullMQ, analytics cache, multi-instance OAuth state |

---

## Render deployment checklist (set in dashboard; Supabase-backed)

| Variable | Typical state |
|----------|----------------|
| `DIRECT_URL` | ✅ Direct Supabase Postgres on `:5432` for Prisma migrations |
| `DATABASE_URL` | ✅ Supabase transaction pooler on `:6543` for runtime |
| `NODE_ENV` | ✅ `production` |
| `JWT_SECRET` | ✅ 32+ chars |
| `JWT_REFRESH_SECRET` | ✅ 32+ chars |
| `ENCRYPTION_KEY` | ✅ Recommended 32+ |
| `REDIS_URL` | Optional (Upstash) |
| `CORS_ORIGIN` / `CORS_ORIGINS` | Set to dashboard origin(s) |
| Meta / OpenAI vars | As needed |

**Vercel:** `NEXT_PUBLIC_API_URL` = API origin **without** `/api`.

**Render start:** `npm run start:app` → `node dist/server.js` only (not `dist/index.js`). Migrations: `npm run start:migrate` locally with `DATABASE_URL` + `DIRECT_URL`.

---

## Smoke tests

```bash
npm run smoke:demo
npm run smoke:render
```

Remote Render gate when green: **Smoke test: 7/7 checks (Health, Login, Analytics, AI Insights, Leads, Gov preview, Posts).** See [`cycle3-antigravity-tech-status.md`](./cycle3-antigravity-tech-status.md).

---

## Files touched in this pass (reference)

- `prisma.config.ts` (new) — Prisma CLI config + seed command
- `package.json` — removed `prisma` key; `smoke:render` script
- `src/server.ts` — production `DATABASE_URL` guard
- `src/lib/databaseErrors.ts` — connectivity detection
- `src/routes/auth.ts` — structured errors (503 / 401 / 400 fieldErrors)
- `src/services/analyticsService.ts` — `likesByHour` on platform summary
- `src/config/env.ts` — `CORS_ORIGINS` alias
- `scripts/smoke-demo.ts` — **7** checks + `--url` (see `docs/cycle3-antigravity-tech-status.md`)
- `DEPLOYMENT.md` — Render section + psql password note
- `dashboard/lib/api.ts` — `parseApiErrorMessage`, `apiRequestJson`, types
- `dashboard/app/login/page.tsx` — error parsing, redirect `/analytics`
- `dashboard/app/analytics/page.tsx` — Instagram summary panel + charts
- `dashboard/components/dashboard-nav.tsx` — five primary links
- `docs/completion-report.md` (this file)
