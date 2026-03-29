<!--
  RENDER + SUPABASE — MANUAL STEPS (read this block first)

  1) Open https://dashboard.render.com → select your **Web Service** (API).

  2) Left sidebar → **Environment** → **Environment Variables**.

  3) Find **DATABASE_URL** (or add it):
     - Value = your **Supabase** connection string (same as working local `.env`).
     - If the DB password contains @ # $ % or other reserved URL characters, **percent-encode** them
       (e.g. @ → %40, # → %23, $ → %24, % → %25) or use Supabase’s “URI” copy that is already encoded.
     - Must NOT be postgresql://...@localhost... on the Web Service.

  4) Click **Save Changes**.

  5) **Manual Deploy** → **Deploy latest commit** (or “Clear build cache & deploy” if the service still fails).

  6) After deploy, verify:
     - GET https://YOUR-API.onrender.com/api/health → 200
     - GET https://YOUR-API.onrender.com/api/health/db → 200 and `{"status":"ok",...}`
       (503 or `status":"error"` here usually means **Render `DATABASE_URL`** is wrong, paused Supabase, or network/firewall — fix env and redeploy.)
     - POST /api/auth/login with demo credentials → 200 and `accessToken` (after migrate + seed via `scripts/prod-setup.sh` or `scripts/prod-db-setup.*`).
     - Optional: `node scripts/smoke-test.js` with `SMOKE_API_BASE=https://YOUR-API.onrender.com`

  7) **Migrations + seed** (once per database):
     - **Render Shell** (if available): `bash scripts/prod-setup.sh`
     - **From your laptop** (same repo, same Prisma schema): point `DATABASE_URL` at production Supabase and run:
       - Bash: `bash scripts/prod-db-setup.sh "postgresql://..."`
       - PowerShell: `.\scripts\prod-db-setup.ps1 -DatabaseUrl "postgresql://..."`
     **Supabase connection string:** Dashboard → your **Project** → **Settings** (gear) → **Database** → **Connection string** → choose **URI** (not “Session mode” unless you use pooler intentionally). Paste the URI; replace `[YOUR-PASSWORD]` with your DB password. If the password contains `@ # $ %` or other reserved URL characters, **percent-encode** them (e.g. `@` → `%40`, `#` → `%23`, `$` → `%24`, `%` → `%25`) or use Supabase’s copy that is already encoded. Running locally is safe **only** when you intend to change **that** database—double-check the host matches your production project before running.

  Optional: Vercel **NEXT_PUBLIC_API_URL** = API origin only (no `/api` suffix); redeploy dashboard after changes.
-->

# Deploy checklist (Render + Vercel + Supabase)

Short reference; detailed click-path is in the HTML comment at the top of this file.

| Step | Where | Action |
|------|--------|--------|
| 1 | Render → Web Service → Environment | Set `DATABASE_URL` to Supabase URL (encoded password). |
| 2 | Render | Save → **Manual deploy**. |
| 3 | Render Shell **or** local machine | Migrate + seed: `bash scripts/prod-setup.sh` on Render, **or** locally `bash scripts/prod-db-setup.sh "postgresql://..."` / `.\scripts\prod-db-setup.ps1 -DatabaseUrl "..."` (see comment block for Supabase URI + password encoding). |
| 4 | Browser / CI | `node scripts/smoke-test.js` with `SMOKE_API_BASE` set to your API origin. |
| 5 | Vercel | `NEXT_PUBLIC_API_URL` = `https://your-api.onrender.com` (origin only). |

See also `docs/DEMO.md` for demo URLs and credentials.
See also `docs/production-verification-checklist.md` for post-deploy seed, login, and smoke verification.
