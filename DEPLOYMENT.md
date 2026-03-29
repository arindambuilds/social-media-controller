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

- `DIRECT_URL` — direct Postgres for Prisma migrations / direct access. Supabase production: direct host on `:5432`.
- `DATABASE_URL` — runtime app connection. Supabase production: transaction pooler on `:6543` with `pgbouncer=true`.
- `REDIS_URL` — Redis / Upstash `rediss://`.
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY` (32+ chars).
- `WEBHOOK_SIGNING_SECRET` for signed inbound social webhooks.
- `APP_BASE_URL` — public API URL (e.g. `https://api.yourdomain.com`).
- `INGESTION_MODE=mock` for demos without Meta; `instagram` when Meta app + tokens are ready.
- `CORS_ORIGIN` — your dashboard origin(s), comma-separated.

## 4. Database migrations

Run migrations against `DIRECT_URL` and use `DATABASE_URL` for runtime:

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
3. Add the **PostgreSQL** plugin if you use Railway Postgres. If you use Supabase instead, set both `DIRECT_URL` and `DATABASE_URL` from Supabase in the service variables.
4. Add **Redis** (Railway plugin) or paste an **Upstash** `REDIS_URL` (`rediss://…`) into variables.
5. Set all required variables from root `.env.example` (`JWT_*`, `ENCRYPTION_KEY`, `APP_BASE_URL`, `CORS_ORIGIN`, `INGESTION_MODE`, optional Meta/LinkedIn keys, `OAUTH_REDIRECT_BASE_URL` pointing at your public API URL, `SENTRY_DSN` optional).
6. **API service** — install/build: `npm ci && npm run build && npx prisma migrate deploy`  
   **Start command:** `npx prisma migrate deploy && node dist/server.js`  
   (Use `npm run prisma:migrate:deploy` if you prefer the npm script alias.)
7. **Worker service** (duplicate repo, same env): start command `node dist/workers/ingestionWorker.js`. Add another service for **`node dist/workers/postPublishWorker.js`** and **`node dist/workers/tokenRefreshWorker.js`** if you use scheduled posts and token refresh jobs.
8. **Dashboard service**: root `dashboard/`, install `npm ci`, build `npm run build`, start `npm start`. Set `NEXT_PUBLIC_API_URL` to the public API **origin only** (e.g. `https://social-media-controller.onrender.com`); the app appends `/api` in code.

Register OAuth redirect URLs with Meta/LinkedIn to match `OAUTH_REDIRECT_BASE_URL` (e.g. `https://api…/api/oauth/facebook/callback`).

## 10. Render.com (Web Service + Supabase)

This repository’s production model is **Supabase**, not Render-managed Postgres:

- `DIRECT_URL` = direct Supabase Postgres on `:5432` for Prisma migrations
- `DATABASE_URL` = Supabase transaction pooler on `:6543` for runtime app connections

Use the exact pooler value Supabase shows you. If Supabase shows an `aws-0-REGION.pooler.supabase.com` hostname, copy it exactly. Do not guess or hand-edit the pooler hostname.

If `DATABASE_URL` still points at `localhost` while `NODE_ENV=production`, the API exits immediately with a fatal log.

### Suggested Render Web Service commands

| Field | Example |
|-------|---------|
| **Build Command** | `npm install && npm run build && npm run db:deploy:seed` |
| **Start Command** | `node dist/server.js` |

`db:deploy:seed` runs `prisma migrate deploy` then `prisma db seed`. In this repo, `prisma migrate deploy` should use `DIRECT_URL`, while the running API uses `DATABASE_URL`.

### Render Web Service — Required Environment Variables

| Variable | Value | Notes |
|---|---|---|
| `DIRECT_URL` | `postgresql://postgres:<PASSWORD>@db.lvlzugnoavgzwzulnnyf.supabase.co:5432/postgres?schema=public&sslmode=require` | Direct Supabase Postgres for Prisma migrations |
| `DATABASE_URL` | `postgresql://postgres:<PASSWORD>@db.lvlzugnoavgzwzulnnyf.supabase.co:6543/postgres?schema=public&pgbouncer=true&sslmode=require` | Supabase transaction pooler for runtime |
| `NODE_ENV` | `production` | Required for production DB guard |
| `JWT_SECRET` | (from local `.env`) | Min 32 chars |
| `JWT_REFRESH_SECRET` | (from local `.env`) | Min 32 chars |
| `ENCRYPTION_KEY` | (from local `.env`) | 64 hex chars (32 bytes) recommended; min 32 chars accepted |
| `REDIS_URL` | `rediss://default:xxx@xxx.upstash.io:6379` | Upstash URL |
| `CORS_ORIGINS` or `CORS_ORIGIN` | `https://your-dashboard.vercel.app` | Comma-separated; no trailing slash |
| `PORT` | `4000` | Render injects `PORT`; ensure app listens on it |
| `OPENAI_API_KEY` | (optional) | Falls back to rule-based insights |
| `SENTRY_DSN` | (optional) | Error tracking |
| `META_APP_ID` | (optional) | Facebook/Instagram OAuth |
| `META_APP_SECRET` | (optional) | Facebook/Instagram OAuth |
| `LINKEDIN_CLIENT_ID` | (optional) | LinkedIn OAuth |
| `LINKEDIN_CLIENT_SECRET` | (optional) | LinkedIn OAuth |
| `INGESTION_MODE` | `mock` | For testing without live platform sync |

After updating Render env vars:

1. Redeploy the service.
2. Verify `GET /api/health/db`.
3. Verify `POST /api/auth/login`.
4. If runtime still fails but migrations worked, compare Render’s `DATABASE_URL` character-for-character with the exact Supabase transaction pooler value. No manual hostname guessing.

### Vercel Dashboard — Required Environment Variables

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://your-api.onrender.com` |

Use the **API origin only** (no `/api`). The dashboard code normalizes this and appends `/api` for routes like `/auth/login`.

## 11. Operational notes

- Run **worker** alongside API for BullMQ jobs (`docker-compose` can add a `worker` service using the same image and `command: npm run worker` after copying source — adjust image if you only ship `dist/`).
- Never commit `.env` or `dashboard/.env.local`.

### PM2 (optional)

See `ecosystem.config.js` at the repo root for API + ingestion + post-publish + token-refresh workers. After `npm run build`, run `pm2 start ecosystem.config.js`.
