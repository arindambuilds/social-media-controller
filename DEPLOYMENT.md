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

## 9. Operational notes

- Run **worker** alongside API for BullMQ jobs (`docker-compose` can add a `worker` service using the same image and `command: npm run worker` after copying source — adjust image if you only ship `dist/`).
- Never commit `.env` or `dashboard/.env.local`.
