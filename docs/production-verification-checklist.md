# Production Verification Checklist

Use this after deploying the API/dashboard and before calling the release ready.

**Schema + gov route parity:** [production-parity-runbook.md](./production-parity-runbook.md) (Render deploy, `GET /api/pulse/gov-preview`, `prisma migrate deploy`, canonical log line).

**Vercel `/gov-preview` + ISR:** [vercel-gov-preview-wiring.md](./vercel-gov-preview-wiring.md) (`NEXT_PUBLIC_API_URL`, redeploy, production checks).

## 1. Confirm Render environment

- `DIRECT_URL` points to the direct Supabase Postgres connection on `:5432` with `sslmode=require`.
- `DATABASE_URL` points to the Supabase transaction pooler on `:6543` with `pgbouncer=true&sslmode=require`.
- `JWT_SECRET` is set and at least 32 characters.
- `JWT_REFRESH_SECRET` is set and at least 32 characters.
- `CORS_ORIGIN` is set correctly for production.
- `APP_BASE_URL` matches the deployed API URL.

## 2. Seed the production demo user

PowerShell:

```powershell
$env:DATABASE_URL="postgresql://...:6543/...?...pgbouncer=true..." 
$env:DIRECT_URL="postgresql://...:5432/...?...sslmode=require"
npx tsx scripts/seed-production.ts
```

Expected success output includes:

```text
seed-production: upserted user id=... email=demo@demo.com clientId=...
```

## 3. Verify production login

**Primary operator:** `demo@demo.com` / `Demo1234!` (alternates: repo README or [DEMO.md](./DEMO.md)).

PowerShell:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "https://<render-api>/api/auth/login" `
  -ContentType "application/json" `
  -Body '{"email":"demo@demo.com","password":"Demo1234!"}'
```

Expected response:

- HTTP `200 OK`
- JSON body:

```json
{
  "success": true,
  "accessToken": "<jwt>",
  "refreshToken": "<jwt>",
  "user": {
    "id": "<id>",
    "email": "demo@demo.com",
    "role": "AGENCY_ADMIN",
    "clientId": "demo-client"
  }
}
```

## 4. Run the production smoke check

```powershell
npm run smoke:render
```

Or explicitly:

```powershell
$env:SMOKE_BASE_URL="https://<render-api>"; npm run smoke:demo
```

Confirm **Smoke test: 7/7 checks (Health, Login, Analytics, AI Insights, Leads, Gov preview, Posts).** Use `npm run smoke:render` or `npm run smoke:render -- --base https://<render-api>`. **Gov preview** (`GET /api/pulse/gov-preview`) is a demo hard blocker if it fails. See [`cycle3-antigravity-tech-status.md`](./cycle3-antigravity-tech-status.md).

Also verify:

- `GET /api/health/db` returns `200`
- `POST /api/auth/login` returns `200`

## 5. If TypeScript seeding fails

Use the SQL fallback:

- `scripts/seed-production-demo-user.sql`

Ensure the SQL uses:

- `"passwordHash"` and not `"password"`
- A real bcrypt hash for the primary operator password (`Demo1234!`)

## 6. Final release gate

- `demo@demo.com` can log in successfully in production.
- Render `DATABASE_URL` matches the exact Supabase transaction pooler value character-for-character.
- No manual hostname guessing was used for the pooler host.
- Smoke checks pass against the deployed API.
- No production env validation errors remain.
- Review local changes with `git status`.
- Commit and push only after the checks above pass.
