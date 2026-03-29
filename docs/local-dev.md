## Local dev (Windows, no Docker)

Backend: **local PostgreSQL** + **hosted Upstash Redis** (or any `rediss://` Redis). The dashboard is a separate Next.js app in `dashboard/`.

---

### Docker Compose (optional)

If [Docker Desktop](https://www.docker.com/products/docker-desktop/) is installed and on your `PATH`:

```powershell
# Postgres + Redis only (use this when you run the API on the host with `npm run dev` — avoids port 4000 conflicting with the compose `api` service)
docker compose up -d postgres redis

# Check health (compose defines healthchecks; wait until STATUS is healthy)
docker compose ps
```

Full stack (API runs **inside** Docker on port 4000 — do **not** also run `npm run dev` on the host):

```powershell
docker compose up -d
```

The `api` service waits until Postgres and Redis report **healthy**.

For containers on localhost, typical URLs are:

- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/social_media_controller?schema=public`
- `DIRECT_URL=` same as `DATABASE_URL` for local Postgres (required by Prisma schema; see `.env.example` for Supabase pooler + direct split).
- `REDIS_URL=redis://localhost:6379` (plain Redis; use `rediss://` only for TLS services like Upstash)

---

### Correct API paths (common mistakes)

| What | URL |
|------|-----|
| Signup | `POST http://localhost:4000/api/auth/signup` |
| Login | `POST http://localhost:4000/api/auth/login` |
| Me | `GET http://localhost:4000/api/auth/me` + `Authorization: Bearer …` |
| Analytics overview | `GET http://localhost:4000/api/analytics/{clientId}/overview?days=30` + Bearer |
| Instagram summary | `GET http://localhost:4000/api/analytics/INSTAGRAM/{clientId}/summary` + Bearer |
| Insights (latest) | `GET http://localhost:4000/api/insights/{clientId}/content-performance/latest` + Bearer |
| Leads | `GET http://localhost:4000/api/leads?clientId={clientId}` + Bearer |

There is **no** top-level `GET /analytics` or `POST /auth/login` — routes live under **`/api/...`** except the browser Instagram alias:

- **Instagram OAuth redirect (browser):** `GET http://localhost:4000/auth/instagram?clientId=demo-client` — requires **Bearer token** (log in first). For `AGENCY_ADMIN`, **`clientId` query is required**; `CLIENT_USER` uses the token’s client. Returns **302** to Meta when the app id is configured.

---

### 1) Install PostgreSQL

```powershell
winget install --id PostgreSQL.PostgreSQL.16 --source winget
```

If that fails, try **Postgres Pro** or install from postgresql.org. Ensure Postgres listens on `localhost:5432`.

---

### 2) Create database

```powershell
psql -U postgres -h localhost -p 5432 -c "CREATE DATABASE social_media_controller;"
```

Match the DB name to `DATABASE_URL` in `.env`.

---

### 3) Redis (Upstash recommended)

1. Create a free Redis database at [https://upstash.com/](https://upstash.com/)
2. Copy the **`rediss://`** connection string into `REDIS_URL`

---

### 4) Configure environment

Copy `.env.example` to `.env` at the **repo root** and set:

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | Local: `postgresql://user:pass@localhost:5432/social_media_controller?schema=public`. Supabase/Render production runtime: transaction pooler on `:6543` with `pgbouncer=true&sslmode=require` |
| `DIRECT_URL` | Local: same as `DATABASE_URL`. Supabase/Render production migrations: direct connection on `:5432` with `sslmode=require` |
| `REDIS_URL` | Upstash `rediss://...` |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Long random strings (32+ chars) |
| `ENCRYPTION_KEY` | At least **32 characters** (token encryption) |
| `APP_BASE_URL` | `http://localhost:4000` |
| `INGESTION_MODE` | **`mock`** for reliable demos without Meta; **`instagram`** when Graph API + tokens are ready |
| `OPENAI_API_KEY` | Optional; enables richer AI (insights/captions) |
| `INSTAGRAM_REDIRECT_URI` | Default API callback — must match Meta app |
| `INSTAGRAM_FRONTEND_REDIRECT_URI` | Dashboard OAuth return, e.g. `http://localhost:3000/onboarding/callback` — **must** be added in Meta app redirect URIs |

**Dashboard:** create `dashboard/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

---

### 5) Install, migrate, seed

```powershell
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

`npx prisma db seed` also works (seed command is set in `package.json` → `prisma.seed`).

For Supabase + Render production:

- `npm run prisma:deploy` should run with `DIRECT_URL` set to the direct `:5432` connection
- the running API should use `DATABASE_URL` set to the transaction pooler on `:6543`

---

### 6) Run API + worker + dashboard

**Terminal 1 — API**

```powershell
npm run dev
```

**Terminal 2 — Ingestion worker** (required for sync jobs)

```powershell
npm run worker
```

**Terminal 3 — Dashboard**

```powershell
npm run dashboard:dev
```

---

### 7) Demo logins (after seed)

**Primary operator / smoke:** `demo@demo.com` / `Demo1234!`

| Role | Email | Password |
|------|--------|----------|
| Primary operator / smoke | `demo@demo.com` | `Demo1234!` |
| Alternate — founder | `admin@demo.com` | `admin123` |
| Alternate — client (Urban Glow) | `salon@pilot.demo` | `pilot123` |
| Alternate — agency (presentations) | `demo@agencyname.com` | `Demo1234!` |

Use the **primary** row for smoke checks and the default dashboard login. Seeded client ID: **`demo-client`** (Urban Glow Studio).

### 7b) Smoke test (API must be running)

```powershell
npm run smoke:local
```

Against production API:

```powershell
npm run smoke:render
```

(`npm run smoke:demo` also runs the same script with default base URL `http://localhost:4000`.)

---

### 8) Mock ingestion (optional extra data)

1. `POST /api/auth/login` with the primary demo credentials → JWT  
2. `POST /api/webhooks/ingestion` with body:

```json
{
  "socialAccountId": "<instagram SocialAccount id from DB or seed>",
  "platform": "INSTAGRAM",
  "trigger": "manual"
   }
   ```

3. Signed social webhook test:

   - Body example:

   ```json
   {"socialAccountId":"demo-social-account","eventType":"comment","externalId":"demo-event-1","text":"price?","authorId":"user-1","authorName":"User 1"}
   ```

   - Sign the raw JSON with HMAC SHA-256 using `WEBHOOK_SIGNING_SECRET`.
   - Send either:
     - `X-Webhook-Signature: <hex digest>`
     - `X-Hub-Signature-256: sha256=<hex digest>`

---

### 9) Smoke-test endpoints

- `GET /health`
- `GET /api/health` (via mounted health router if present)
- `POST /api/auth/login`
- `GET /api/auth/me` (with Bearer token)
- `GET /api/analytics/INSTAGRAM/demo-client/summary`
- `GET /api/analytics/demo-client/overview?days=30` (newer analytics routes)
- Dashboard: login → Analytics → Insights

---

### Windows / tooling notes

- **`EPERM` on Prisma generate** (locked `query_engine`): close editors/AV scanning `node_modules`, retry, or run terminal **as Administrator** once.  
- **`tsx` / `next` spawn errors:** use a normal PowerShell or CMD (not a broken sandbox); Node LTS recommended.

---

### curl (PowerShell)

```powershell
curl.exe http://localhost:4000/health
```

```powershell
$body = '{"email":"demo@demo.com","password":"Demo1234!"}'
Invoke-RestMethod -Uri "http://localhost:4000/api/auth/login" -Method POST -Body $body -ContentType "application/json; charset=utf-8"
```

Use the returned `accessToken` as `Authorization: Bearer <token>` for protected routes. (Raw `curl.exe -d "{...}"` often breaks JSON escaping in PowerShell.)
