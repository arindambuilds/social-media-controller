# Deployment (Ubuntu + Docker, API)

This document covers hosting the **API** (`Dockerfile` at repo root). The **dashboard** is a separate Next.js app (`dashboard/`); build it with `npm --prefix dashboard run build` and run `next start`, or deploy to Vercel/Netlify with `NEXT_PUBLIC_API_URL` pointing at your API.

## 1. Fresh Ubuntu server

- Ubuntu 22.04+ LTS recommended.
- Open ports **80/443** (reverse proxy) and **4000** only if you expose the API directly (not recommended).

## 2. Install Docker

```bash
sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker "$USER"
```

Log out and back in so `docker` works without `sudo`.

## 3. Clone and configure

```bash
git clone https://github.com/arindambuilds/social-media-controller.git
cd social-media-controller
cp .env.example .env
```

Edit `.env`:

- `DATABASE_URL` — Postgres (managed or container).
- `REDIS_URL` — Redis / Upstash `rediss://`.
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY` (32+ chars).
- `APP_BASE_URL` — public API URL (e.g. `https://api.yourdomain.com`).
- `INGESTION_MODE=mock` for demos without Meta; `instagram` when Meta app + tokens are ready.
- `CORS_ORIGIN` — your dashboard origin(s), comma-separated.

## 4. Database migrations

Run against the same `DATABASE_URL`:

```bash
npm ci
npx prisma migrate deploy
npx tsx prisma/seed.ts
```

## 5. Build and run API container

```bash
docker build -t smc-api .
docker run -d --name smc-api -p 4000:4000 --env-file .env smc-api
```

Verify:

```bash
curl -s http://127.0.0.1:4000/health | jq .
```

## 6. Dashboard

On a host or second container:

```bash
cd dashboard
cp .env.local.example .env.local
# Set NEXT_PUBLIC_API_URL=https://api.yourdomain.com
npm ci
npm run build
npm start
```

## 7. Domain + TLS

- Point **A/AAAA** records for `api.yourdomain.com` to the server.
- Use **Caddy** or **nginx** + **Let’s Encrypt** to terminate TLS and reverse-proxy to `127.0.0.1:4000` (API) and `127.0.0.1:3000` (dashboard) if both run on the same machine.

## 8. Meta / Instagram (manual)

1. Create a Meta app with Instagram Graph / Login products.
2. Add **OAuth redirect URIs** matching `INSTAGRAM_REDIRECT_URI` and `INSTAGRAM_FRONTEND_REDIRECT_URI` in `.env`.
3. Set `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` (or `FACEBOOK_*` equivalents used by the code).
4. Set `INGESTION_MODE=instagram` and run the **ingestion worker** (`npm run worker`) with the same Redis as the API.

## 9. Railway.app (API + Redis/Postgres + workers + dashboard)

1. Push the repo to GitHub (if not already).
2. In [Railway](https://railway.app), create a project → **Deploy from GitHub repo** and select this repository.
3. Add the **PostgreSQL** plugin; copy `DATABASE_URL` into the API service variables.
4. Add **Redis** (Railway plugin) or paste an **Upstash** `REDIS_URL` (`rediss://…`) into variables.
5. Set all required variables from root `.env.example` (`JWT_*`, `ENCRYPTION_KEY`, `APP_BASE_URL`, `CORS_ORIGIN`, `INGESTION_MODE`, optional Meta/LinkedIn keys, `OAUTH_REDIRECT_BASE_URL` pointing at your public API URL, `SENTRY_DSN` optional).
6. **API service** — install/build: `npm ci && npm run build && npx prisma migrate deploy`  
   **Start command:** `npx prisma migrate deploy && node dist/server.js`  
   (Use `npm run prisma:migrate:deploy` if you prefer the npm script alias.)
7. **Worker service** (duplicate repo, same env): start command `node dist/workers/ingestionWorker.js`. Add another service for **`node dist/workers/postPublishWorker.js`** and **`node dist/workers/tokenRefreshWorker.js`** if you use scheduled posts and token refresh jobs.
8. **Dashboard service**: root `dashboard/`, install `npm ci`, build `npm run build`, start `npm start`. Set `NEXT_PUBLIC_API_URL` to the public API origin (e.g. `https://social-media-controller.onrender.com`).

Register OAuth redirect URLs with Meta/LinkedIn to match `OAUTH_REDIRECT_BASE_URL` (e.g. `https://api…/api/oauth/facebook/callback`).

## 10. Render.com (Web Service + PostgreSQL)

### Internal vs external `DATABASE_URL`

- **Internal Database URL** — use on your **Render Web Service** in the same region/account so the API can reach Postgres over Render’s private network (hostname like `dpg-xxxx.REGION-postgres.render.com`).
- **External URL** — for tools running **outside** Render (your laptop, CI, etc.).

If `DATABASE_URL` still points at `localhost` while `NODE_ENV=production`, the API **exits immediately** with a fatal log (misconfiguration guard).

### Rotate Postgres password from Windows (`psql`)

Use the installed binary, e.g.:

```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" "postgresql://USER:OLD_PASSWORD@HOST:5432/DBNAME" -c "ALTER USER your_user WITH PASSWORD 'SecureNewPass2024!';"
```

Then update **`DATABASE_URL`** in Render → Web Service → **Environment** with the new password and **redeploy**.

### Suggested Render Web Service commands

| Field | Example |
|-------|---------|
| **Build Command** | `npm install && npm run build && npm run db:deploy:seed` |
| **Start Command** | `node dist/server.js` |

`db:deploy:seed` runs `prisma migrate deploy` then `prisma db seed` (seed uses upserts; safe to re-run for demos). For large production datasets, run migrate in build and seed **once** from **Render Shell** instead.

### Environment checklist (API)

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | Yes | From Render Postgres (internal URL on the web service). |
| `NODE_ENV` | Yes | `production` |
| `JWT_SECRET` | Yes | 32+ chars |
| `JWT_REFRESH_SECRET` | Yes | 32+ chars |
| `ENCRYPTION_KEY` | Recommended | 32+ chars (or rely on JWT-derived key per app logic). |
| `REDIS_URL` | Optional | Upstash `rediss://…` for BullMQ/cache. |
| `CORS_ORIGIN` or `CORS_ORIGINS` | Optional | Comma-separated origins; both names are supported in code. |

**Vercel dashboard:** set `NEXT_PUBLIC_API_URL` to the API **origin only** (no `/api` suffix), e.g. `https://social-media-controller.onrender.com`.

## 11. Operational notes

- Run **worker** alongside API for BullMQ jobs (`docker-compose` can add a `worker` service using the same image and `command: npm run worker` after copying source — adjust image if you only ship `dist/`).
- Never commit `.env` or `dashboard/.env.local`.

### PM2 (optional)

See `ecosystem.config.js` at the repo root for API + ingestion + post-publish + token-refresh workers. After `npm run build`, run `pm2 start ecosystem.config.js`.
