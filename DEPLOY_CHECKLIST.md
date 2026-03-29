## CRITICAL DEPLOYMENT RULE (Render + Supabase)

**Render start command must always be:** `npm run start:app`  
(which runs **`node dist/server.js` only** — this repo’s compiled entry is **`dist/server.js`**, not `dist/index.js`.)

**Migrations must never run on Render boot.** Render often cannot reach Supabase **direct** Postgres (`DIRECT_URL`, port **5432**); you will see **P1001** (sometimes shown as a mangled host like `29:5432` if the URL is broken).

**Run migrations locally** (or any machine that can open port 5432) **before** or **after** deploy, whenever the schema changes:

```powershell
# PowerShell — paste your real URLs from Supabase
$env:DATABASE_URL = "postgresql://...@....pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require"
$env:DIRECT_URL   = "postgresql://...@db.<ref>.supabase.co:5432/postgres?sslmode=require"
npx prisma migrate deploy
```

```bash
# Mac/Linux
DATABASE_URL="postgresql://...:6543/..." DIRECT_URL="postgresql://...:5432/..." npx prisma migrate deploy
```

**Why**

| URL | Port | Used for | From Render |
|-----|------|----------|-------------|
| `DATABASE_URL` | **6543** (transaction pooler) | Runtime Prisma queries | Usually works |
| `DIRECT_URL` | **5432** (direct DB) | `prisma migrate deploy` | Often **fails** → do not migrate on boot |

**npm scripts**

- `npm run start` / `npm run start:app` → start API only (no DB migrate).
- `npm run start:migrate` → `prisma migrate deploy` only (use **locally** with both env vars set).

---

<!--
  RENDER + SUPABASE — MANUAL STEPS (read this block first)

  1) Open https://dashboard.render.com → select your **Web Service** (API).

  2) Left sidebar → **Environment** → **Environment Variables**.

  3) Set **Supabase** URLs:
     - **DATABASE_URL** = **Transaction pooler** only (host like `*.pooler.supabase.com`, port **6543**). Must NOT be `db.*.supabase.co:5432` — the app + PgBouncer need the pooler. Append **`pgbouncer=true`** and **`sslmode=require`** if missing.
     - **DIRECT_URL** = **Direct connection** (`db.<project-ref>.supabase.co`, port **5432**, **`sslmode=require`**). Used only for **`npm run start:migrate`** / `npx prisma migrate deploy` when run **locally** — not on Render boot.
     - **Do not** put `prisma migrate deploy` in Render Start Command. Use **`npm run start:app`**.
     - Encode special characters in the password in both URLs as needed.
     - Must NOT be `...@localhost...` on the Web Service.

  4) Click **Save Changes**.

  5) **Settings → Start Command** → `npm run start:app` → Save.

  6) **Manual Deploy** → **Deploy latest commit** (or “Clear build cache & deploy” if the service still fails).

  7) After deploy, verify:
     - GET https://YOUR-API.onrender.com/api/health → 200
     - GET https://YOUR-API.onrender.com/api/health/db → 200 and `{"status":"ok","database":"connected",...}`
       (503 or `status":"error"` here usually means **Render `DATABASE_URL`** is wrong, paused Supabase, or network/firewall — fix env and redeploy.)
     - POST /api/auth/login with demo credentials → 200 and `accessToken` (after migrate + seed **from your laptop**).
     - Optional: `node scripts/smoke-test.js` with `SMOKE_API_BASE=https://YOUR-API.onrender.com`

  8) **Migrations + seed** (from your machine — no Render Shell required):
     - Set `DATABASE_URL` (pooler) and `DIRECT_URL` (direct), then: `npm run start:migrate`
     - Seed: `npx tsx prisma/seed.ts` with `DATABASE_URL` set to the **pooler** URL (or use `scripts/prod-db-setup.*` with both URLs).
     **Supabase:** Settings → Database → **Transaction pooler** (for `DATABASE_URL`) and **Direct connection** (for `DIRECT_URL`). See root `.env.example`.

  Optional: Vercel **NEXT_PUBLIC_API_URL** = API origin only (no `/api` suffix); redeploy dashboard after changes.
-->

# Deploy checklist (Render + Vercel + Supabase)

Short reference; detailed click-path is in the HTML comment above.

| Step | Where | Action |
|------|--------|--------|
| 1 | Render → Web Service → Environment | Set **`DATABASE_URL`** (pooler **`:6543`**) and **`DIRECT_URL`** (direct **`:5432`**). |
| 2 | Render → Settings → **Start Command** | **`npm run start:app`** (never run migrate on boot). |
| 3 | Render | Save → **Manual deploy**. |
| 4 | **Your laptop** | `npm run start:migrate` + `npx tsx prisma/seed.ts` with env vars set (see CRITICAL block). |
| 5 | Browser / CI | `node scripts/smoke-test.js` with `SMOKE_API_BASE` set to your API origin. |
| 6 | Vercel | `NEXT_PUBLIC_API_URL` = `https://your-api.onrender.com` (origin only). |

See also `docs/DEMO.md` for demo URLs and credentials.
See also `docs/production-verification-checklist.md` for post-deploy seed, login, and smoke verification.
