## Local dev (Windows, no Docker)

Backend: **local PostgreSQL** + **hosted Upstash Redis** (or any `rediss://` Redis). The dashboard is a separate Next.js app in `dashboard/`.

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
| `DATABASE_URL` | `postgresql://user:pass@localhost:5432/social_media_controller?schema=public` |
| `REDIS_URL` | Upstash `rediss://...` |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Long random strings (16+ chars) |
| `ENCRYPTION_KEY` | At least **32 characters** (token encryption) |
| `APP_BASE_URL` | `http://localhost:4000` |
| `INGESTION_MODE` | **`mock`** for reliable demos without Meta; **`instagram`** when Graph API + tokens are ready |
| `OPENAI_API_KEY` | Optional; enables richer AI (insights/captions) |
| `INSTAGRAM_REDIRECT_URI` | Default API callback — must match Meta app |
| `INSTAGRAM_FRONTEND_REDIRECT_URI` | Dashboard OAuth return, e.g. `http://localhost:3000/onboarding/callback` — **must** be added in Meta app redirect URIs |

**Dashboard:** create `dashboard/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
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

| Role | Email | Password |
|------|--------|----------|
| Agency / founder | `admin@demo.com` | `admin123` |
| Client (Urban Glow manager) | `salon@pilot.demo` | `pilot123` |

Client ID for both is seeded as **`demo-client`** (Urban Glow Studio).

### 7b) Smoke test (API must be running)

```powershell
npm run smoke:demo
```

---

### 8) Mock ingestion (optional extra data)

1. `POST /api/auth/login` with the demo credentials → JWT  
2. `POST /api/webhooks/ingestion` with body:

```json
{
  "socialAccountId": "<instagram SocialAccount id from DB or seed>",
  "platform": "INSTAGRAM",
  "trigger": "manual"
}
```

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
curl.exe -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"admin@demo.com\",\"password\":\"admin123\"}"
```

Use the returned `accessToken` as `Authorization: Bearer <token>` for protected routes.
