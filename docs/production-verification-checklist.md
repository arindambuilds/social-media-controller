# Production Verification Checklist

Use this after deploying the API/dashboard and before calling the release ready.

## 1. Confirm Render environment

- `DATABASE_URL` points to the intended Supabase Postgres instance.
- `JWT_SECRET` is set and at least 32 characters.
- `JWT_REFRESH_SECRET` is set and at least 32 characters.
- `CORS_ORIGIN` is set correctly for production.
- `APP_BASE_URL` matches the deployed API URL.

## 2. Seed the production demo user

PowerShell:

```powershell
$env:DATABASE_URL="postgresql://..."; npx tsx scripts/seed-production.ts
```

Expected success output includes:

```text
seed-production: upserted user id=... email=demo@demo.com clientId=...
```

## 3. Verify production login

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

Confirm the smoke flow passes health, auth, analytics, insights, and leads checks.

## 5. If TypeScript seeding fails

Use the SQL fallback:

- `scripts/seed-production-demo-user.sql`

Ensure the SQL uses:

- `"passwordHash"` and not `"password"`
- A real bcrypt hash for `Demo1234!`

## 6. Final release gate

- `demo@demo.com` can log in successfully in production.
- Smoke checks pass against the deployed API.
- No production env validation errors remain.
- Review local changes with `git status`.
- Commit and push only after the checks above pass.
