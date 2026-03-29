# Instagram Growth Copilot — Demo Guide

## Live URLs

- **App:** https://social-media-controller.vercel.app  
- **API:** https://social-media-controller.onrender.com  

## Login credentials

**Primary (operator / default demo):**

- **Email:** `demo@demo.com`  
- **Password:** `Demo1234!`  

**Alternates** (same seeded DB):

- `demo@agencyname.com` / `Demo1234!` — “Growth Agency” (agency admin)  
- `admin@demo.com` / `admin123` — founder alternate  
- `salon@pilot.demo` / `pilot123` — client user for **Arома Silk House** (store manager pilot)  

## Demo script (~5 minutes)

1. Open the **app** URL.  
2. **Log in** with `demo@demo.com` / `Demo1234!`.  
3. **Dashboard** — follower counts, engagement context, client switcher (Arома Silk House / Coastal Cafe).  
4. **Analytics** — ~30 days of seeded post metrics and charts.  
5. **Insights** — AI-style recommendations (OpenAI when configured; otherwise seeded copy).  
6. **Leads** — sample DMs/comments leads for both demo clients.  
7. **Onboarding** — **Connect Instagram** (requires Meta app + redirect URIs below).  

## What the app does

- Instagram-oriented analytics for agencies (multi-client).  
- AI-assisted content recommendations and captions (optional OpenAI).  
- Lead tracking from Instagram-style sources.  
- Scheduled/outbound posting and workers (optional Redis).  

## Demo clients (seeded)

- **Arома Silk House** — saree & ethnic wear, Bhubaneswar — `@aromasilkhouse`  
- **Coastal Cafe Co** — `@coastal.cafe.bbsr`  

## Meta / Instagram OAuth — redirect URIs

Register these in the Meta developer app (**Valid OAuth Redirect URIs** / related settings):

1. **API (token exchange / server callback):**  
   `https://social-media-controller.onrender.com/api/auth/instagram/callback`  
   (Alias also exists: `/api/auth/oauth/instagram/callback` — use whichever matches your app config.)

2. **Browser return (Vercel onboarding):**  
   `https://social-media-controller.vercel.app/onboarding/callback`  

Set **`OAUTH_REDIRECT_BASE_URL`** on the API to your public API origin, e.g.  
`https://social-media-controller.onrender.com`  
and align **`INSTAGRAM_REDIRECT_URI`** / **`INSTAGRAM_FRONTEND_REDIRECT_URI`** with the values above.

## Environment checklist (Vercel)

- `NEXT_PUBLIC_API_URL=https://social-media-controller.onrender.com` — **origin only, no `/api` suffix** (the dashboard appends `/api` in code).  
- `NEXT_PUBLIC_INSTAGRAM_REDIRECT_URI=https://social-media-controller.vercel.app/onboarding/callback`  

Redeploy the dashboard after changing variables.

## Environment checklist (Render API)

- **`DATABASE_URL` (required):** For this repo’s Supabase production model, use the Supabase transaction pooler on `:6543` with `pgbouncer=true&sslmode=require`.  
- **`DIRECT_URL` (required for migrations / direct access):** Use the direct Supabase Postgres connection on `:5432` with `sslmode=require`.  
  - Do **not** leave the default `localhost` connection string — the API will refuse to start in `NODE_ENV=production` if `DATABASE_URL` still points at `localhost` / `127.0.0.1`.  
- **`JWT_SECRET`** (32+ chars), **`JWT_REFRESH_SECRET`** (32+ chars), **`ENCRYPTION_KEY`** (32+ chars optional if you rely on JWT-derived encryption per code).  
- **`NODE_ENV=production`**  
- Optional: `REDIS_URL`, `OPENAI_API_KEY`, Meta app IDs/secrets.  
- **`RENDER_EXTERNAL_URL`** is set automatically on Render and is used for `APP_BASE_URL` when unset.

## Seeding production / Render

1. Fix both `DATABASE_URL` and `DIRECT_URL`, then redeploy so the service can reach Supabase correctly.  
2. Open **Render Shell** (or any shell with the same `DATABASE_URL` + `DIRECT_URL`):

```bash
npx prisma migrate deploy
npx prisma db seed
```

This creates demo users (`demo@demo.com`, `demo@agencyname.com`, etc.), **Arома Silk House** + **Coastal Cafe** clients, ~30 days of posts per seeded IG account, sample leads, and stored insights.

**Auth errors:** Login/signup return **503** with a generic message if the database is unreachable (no Prisma stack traces to the browser). Invalid credentials stay **401**.

## Known limitations

- **Render free tier:** first request after idle can take **~50s** (cold start).  
- **No Redis:** queues run inline; OAuth state is in-memory on a single instance.  
- **Real Instagram data** requires valid tokens, `INGESTION_MODE=instagram`, and Meta app review where applicable.  

## Next steps for a first paying customer

- Move API + DB to always-on / paid tiers; add Redis for jobs and multi-instance OAuth state.  
- Complete Meta app review and document scopes.  
- Stripe/billing routes for subscription (already scaffolded in API).  
- Custom domain + SSL for API and app.  
