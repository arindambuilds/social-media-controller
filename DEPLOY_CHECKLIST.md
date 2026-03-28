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
     - POST /api/auth/login with demo credentials → 200 and `accessToken` (after seed; see scripts/prod-setup.sh).

  7) **Render Shell** (service → Shell): run migrate + seed once per database:
     bash scripts/prod-setup.sh
     (or paste the commands from that file).

  Optional: Vercel **NEXT_PUBLIC_API_URL** = API origin only (no `/api` suffix); redeploy dashboard after changes.
-->

# Deploy checklist (Render + Vercel + Supabase)

Short reference; detailed click-path is in the HTML comment at the top of this file.

| Step | Where | Action |
|------|--------|--------|
| 1 | Render → Web Service → Environment | Set `DATABASE_URL` to Supabase URL (encoded password). |
| 2 | Render | Save → **Manual deploy**. |
| 3 | Render Shell | `bash scripts/prod-setup.sh` (migrate + seed). |
| 4 | Browser / CI | `node scripts/smoke-test.js` with `SMOKE_API_BASE` set to your API origin. |
| 5 | Vercel | `NEXT_PUBLIC_API_URL` = `https://your-api.onrender.com` (origin only). |

See also `docs/DEMO.md` for demo URLs and credentials.
