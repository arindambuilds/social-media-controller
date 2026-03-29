<!--
  RENDER + SUPABASE — MANUAL STEPS (read this block first)

  1) Open https://dashboard.render.com → select your **Web Service** (API).

  2) Left sidebar → **Environment** → **Environment Variables**.

  3) Set **Supabase** URLs (Render cannot use direct `:5432` to `db.*.supabase.co` — use the **Transaction pooler**):
     - **DATABASE_URL** = Supabase → Settings → Database → **Transaction pooler** URI (host like `*.pooler.supabase.com`, port **6543**). Append **`?pgbouncer=true`** (and **`sslmode=require`**) if not already in the string — required for Prisma + PgBouncer.
     - **DIRECT_URL** = **Direct connection** URI (host `db.<project-ref>.supabase.co`, port **5432**) with **`sslmode=require`**. Used for `prisma migrate` / introspection only.
     - Encode special characters in the password in both URLs as needed.
     - Must NOT be `...@localhost...` on the Web Service.

  4) Click **Save Changes**.

  5) **Manual Deploy** → **Deploy latest commit** (or “Clear build cache & deploy” if the service still fails).

  6) After deploy, verify:
     - GET https://YOUR-API.onrender.com/api/health → 200
     - GET https://YOUR-API.onrender.com/api/health/db → 200 and `{"status":"ok","database":"connected",...}`
       (503 or `status":"error"` here usually means **Render `DATABASE_URL`** is wrong, paused Supabase, or network/firewall — fix env and redeploy.)
     - POST /api/auth/login with demo credentials → 200 and `accessToken` (after migrate + seed via `scripts/prod-setup.sh` or `scripts/prod-db-setup.*`).
     - Optional: `node scripts/smoke-test.js` with `SMOKE_API_BASE=https://YOUR-API.onrender.com`

  7) **Migrations + seed** (once per database):
     - **Render Shell** (if available): `bash scripts/prod-setup.sh`
     - **From your laptop:** pass **pooler** URL as first arg and **direct** URL as second (or set `DIRECT_URL` in the environment):
       - Bash: `bash scripts/prod-db-setup.sh "$POOLER_URL" "$DIRECT_URL"`
       - PowerShell: `.\scripts\prod-db-setup.ps1 -DatabaseUrl $POOLER -DirectUrl $DIRECT`
     **Supabase:** Settings → Database → **Transaction pooler** (for `DATABASE_URL`) and **Direct connection** (for `DIRECT_URL`). See root `.env.example`.

  Optional: Vercel **NEXT_PUBLIC_API_URL** = API origin only (no `/api` suffix); redeploy dashboard after changes.
-->

# Deploy checklist (Render + Vercel + Supabase)

Short reference; detailed click-path is in the HTML comment at the top of this file.

| Step | Where | Action |
|------|--------|--------|
| 1 | Render → Web Service → Environment | Set **`DATABASE_URL`** (Supabase **Transaction pooler** `:6543`, `pgbouncer=true`) and **`DIRECT_URL`** (direct `:5432`, `sslmode=require`). |
| 2 | Render | Save → **Manual deploy**. |
| 3 | Render Shell **or** local machine | Migrate + seed: on Render, ensure both env vars are set then `bash scripts/prod-setup.sh`; locally `prod-db-setup` with pooler + direct URLs (see comment block). |
| 4 | Browser / CI | `node scripts/smoke-test.js` with `SMOKE_API_BASE` set to your API origin. |
| 5 | Vercel | `NEXT_PUBLIC_API_URL` = `https://your-api.onrender.com` (origin only). |

See also `docs/DEMO.md` for demo URLs and credentials.
See also `docs/production-verification-checklist.md` for post-deploy seed, login, and smoke verification.
