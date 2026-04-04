# Deploy Checklist

Use this checklist for this repository's real production model:

- `DIRECT_URL` = direct Supabase Postgres on `:5432` for Prisma migrations / direct access
- `DATABASE_URL` = Supabase transaction pooler on `:6543` for runtime app usage

## 1. Local `.env`

- [ ] `DIRECT_URL=postgresql://postgres:<PASSWORD>@db.lvlzugnoavgzwzulnnyf.supabase.co:5432/postgres?schema=public&sslmode=require`
- [ ] `DATABASE_URL=postgresql://postgres:<PASSWORD>@db.lvlzugnoavgzwzulnnyf.supabase.co:6543/postgres?schema=public&pgbouncer=true&sslmode=require`
- [ ] `JWT_SECRET` and `JWT_REFRESH_SECRET` are set
- [ ] `ENCRYPTION_KEY` is set
- [ ] `CORS_ORIGIN` is set for production
- [ ] `REDIS_URL` is set if workers / queue / cache are required

If Supabase shows an alternate pooler hostname such as `aws-0-REGION.pooler.supabase.com`, use the exact value Supabase provides. Do not guess the hostname.

## 2. Prisma command order

Run in this order:

```powershell
npm install
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
```

Expectations:

- `npm run prisma:deploy` uses `DIRECT_URL`
- the running API uses `DATABASE_URL`

## 3. Render environment

- [ ] `DIRECT_URL` is the direct Supabase `:5432` connection
- [ ] `DATABASE_URL` is the Supabase transaction pooler `:6543` connection
- [ ] `DATABASE_URL` includes `pgbouncer=true`
- [ ] both URLs include `schema=public`
- [ ] both URLs include `sslmode=require`
- [ ] `NODE_ENV=production`
- [ ] `APP_BASE_URL` is correct, or `RENDER_EXTERNAL_URL` is available
- [ ] `REDIS_URL` is set to a real non-localhost Redis instance if email / BullMQ workers are expected to run
- [ ] `EMAIL_FROM_ADDRESS` is set
- [ ] either `POSTMARK_API_TOKEN` is set, or `EMAIL_PROVIDER=ses` with AWS SES credentials is set
- [ ] decide worker mode:
  - embedded in API: leave `START_EMAIL_WORKER_IN_API` unset / true
  - standalone worker: set `START_EMAIL_WORKER_IN_API=false` and run `npm run worker:email`
- [ ] do not leave both API embedded worker and a standalone `worker:email` service running unless you explicitly want multiple consumers
- [ ] optional: `POSTMARK_WEBHOOK_SECRET` is set if Postmark webhooks should require `x-postmark-webhook-token`

## 4. Redeploy order

1. Save Render environment variables
2. Redeploy the API service
3. Wait for boot completion
4. Verify runtime health
5. Verify authentication

## 5. Runtime checks

- [ ] `GET /api/health/db` returns `200` with `{"status":"ok"}`
- [ ] `POST /api/auth/login` returns `200`
- [ ] `GET /api/auth/me` works with the returned bearer token
- [ ] `POST /api/execute` with `requestEmailOnCompletion=true` enqueues and sends one real email
- [ ] `EmailLog` row is created and moves through `QUEUED` -> `SENT` / `DELIVERED`

## 6. Dashboard verification

- [ ] Vercel `NEXT_PUBLIC_API_URL` is set to the API origin only
- [ ] Dashboard login succeeds
- [ ] Analytics page loads
- [ ] No browser CORS errors appear

## 7. Troubleshooting

If migrations succeed but the API still fails:

- Treat that as a runtime `DATABASE_URL` problem first
- Compare Render's `DATABASE_URL` character-for-character with the exact Supabase transaction pooler value
- Do not manually guess or rewrite the pooler hostname

If you see `Tenant or user not found`:

- the pooler host / username / tenant string is wrong
- recopy the exact transaction pooler value from Supabase

If email jobs are not being processed:

- check whether `START_EMAIL_WORKER_IN_API` is disabled
- if disabled, verify a separate `npm run worker:email` service is running
- confirm `REDIS_URL` is non-localhost and reachable
- confirm at least one provider is configured before the first real send

If Postmark webhooks return 401:

- compare `x-postmark-webhook-token` against `POSTMARK_WEBHOOK_SECRET`
- if you do not want token enforcement, leave `POSTMARK_WEBHOOK_SECRET` unset

## 8. Final release gate

- [ ] `DIRECT_URL` is direct `:5432`
- [ ] `DATABASE_URL` is pooled `:6543`
- [ ] Prisma deploy succeeds
- [ ] Seed succeeds
- [ ] `GET /api/health/db` succeeds
- [ ] `POST /api/auth/login` succeeds
- [ ] Dashboard login succeeds
- [ ] one real `/api/execute` email flow succeeds
- [ ] one Postmark bounce / complaint webhook updates `EmailLog` and `EmailSuppression`
