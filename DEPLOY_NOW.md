# PulseOS — Deploy Now

## Backend (Render)

### First deploy or update
1. Push to `main` so Render auto-deploys from `render.yaml`, or trigger a manual deploy from the Render dashboard.
2. Confirm the Render web service is named `social-media-controller`.
3. Confirm Render is using:
   - Build command: `npm ci && npx prisma generate && npm run build`
   - Start command: `npx prisma migrate deploy && node dist/index.js`
   - Health check path: `/api/health`

### Env vars to set in the Render dashboard
Set these on the web service, and mirror the same values on the WhatsApp workers if you use them.

| Variable | Example value | Why it matters | If missing |
| --- | --- | --- | --- |
| `NODE_ENV` | `production` | Enables production-safe behavior | App behavior is wrong or env validation fails |
| `APP_BASE_URL` | `https://social-media-controller.onrender.com` | Canonical backend URL for redirects and links | App degrades and callback URLs can break |
| `DASHBOARD_URL` | `https://social-media-controller.vercel.app` | Dashboard return target and billing links | Billing/auth redirects can break |
| `CORS_ORIGIN` | `https://social-media-controller.vercel.app` | Exact credentialed browser allowlist | Cross-origin auth/refresh fails |
| `AUTH_HTTPONLY_COOKIES` | `true` | Required for cross-origin session restore | Users get logged out on reload |
| `DATABASE_URL` | `postgresql://...:6543/postgres?schema=public&pgbouncer=true&sslmode=require` | Runtime Prisma connection | App fails to boot |
| `DIRECT_URL` | `postgresql://...:5432/postgres?schema=public&sslmode=require` | Prisma migrate / direct DB access | Startup migrate step fails |
| `JWT_SECRET` | `<32+ char secret>` | Access-token signing | Env validation fails |
| `JWT_REFRESH_SECRET` | `<32+ char secret>` | Refresh-token signing | Env validation fails |
| `REDIS_URL` | `rediss://default:***@host:6379` | BullMQ queues, workers, rate limits | API can boot, but queues/workers and Redis-backed features degrade |

Notes:
- This repo uses `JWT_REFRESH_SECRET`, not `REFRESH_TOKEN_SECRET`.
- `DATABASE_URL` and `DIRECT_URL` must both be set for the Render start command to succeed.
- `CORS_ORIGIN` cannot be `*` in production.

### Verify backend is live
```bash
curl https://social-media-controller.onrender.com/api/health
```

Expected shape:
```json
{
  "status": "ok",
  "timestamp": "2026-04-05T00:00:00.000Z",
  "environment": "production"
}
```

Optional deeper check:
```bash
curl https://social-media-controller.onrender.com/api/health?deps=1
```

## Dashboard (Vercel)

### Deploy
1. Connect the repo to Vercel if it is not already connected.
2. Set the root directory to `dashboard/`.
3. Framework preset: `Next.js`.
4. Install command: `npm install`
5. Build command: `npm run build`
6. Output directory: `.next`

### Env vars to set in the Vercel dashboard

| Variable | Example value | Why it matters | If missing |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `https://social-media-controller.onrender.com` | Primary API origin used by browser and server code | Production falls back to the default Render origin; wrong host causes auth/proxy breakage |
| `NEXT_PUBLIC_API_URL` | `https://social-media-controller.onrender.com` | Alternate key still read by existing code and scripts | Some routes/scripts may miss the API origin |
| `NEXT_PUBLIC_DASHBOARD_URL` | `https://social-media-controller.vercel.app` | Public dashboard origin for redirects and success URLs | Billing/OAuth return URLs can drift |
| `NEXT_PUBLIC_INSTAGRAM_REDIRECT_URI` | `https://social-media-controller.vercel.app/onboarding/callback` | Frontend OAuth callback URL | Instagram onboarding callback breaks |
| `NEXT_PUBLIC_ENABLE_MOCK_BILLING` | `false` | Ensures cloud billing uses Razorpay, not the local mock path | Billing stays in demo mode |
| `RAZORPAY_KEY_ID` | `rzp_test_xxxxx` or live key | Server-side order creation | Checkout cannot start |
| `RAZORPAY_KEY_SECRET` | `<secret>` | Server-side Razorpay verification | Payment verification fails |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | `rzp_test_xxxxx` or live key | Client Razorpay modal key | Razorpay modal cannot open |

Notes:
- No `NextAuth` dependency was found in the dashboard codebase, so `NEXTAUTH_URL` is not required here.
- `dashboard/lib/api.ts` is correctly wired already:
  - Development fallback: `http://localhost:4000`
  - Production: `NEXT_PUBLIC_API_BASE_URL` or `NEXT_PUBLIC_API_URL`

### Verify dashboard is live
1. Open `https://social-media-controller.vercel.app/login` (or your actual Vercel production URL).
2. In the browser network tab, confirm dashboard API calls resolve to `https://social-media-controller.onrender.com`.
3. Confirm login, dashboard, analytics, and billing all load without cross-origin auth failures.

## Full Customer Flow Verification (production)
1. Open your dashboard production URL.
2. Log in with a real seeded or production-ready account.
3. Visit:
   - `/dashboard`
   - `/analytics`
   - `/billing`
4. Confirm analytics requests go to the Render backend.
5. On billing, trigger Razorpay test checkout using test keys.
6. Confirm the app redirects to `/success?razorpay_payment_id=...`.
7. Confirm backend health:
   ```bash
   curl https://social-media-controller.onrender.com/api/health
   ```

## Common Issues
- `render.yaml` is the deployment source of truth for commands. Some older docs still mention `dist/server.js`, but the current compiled entry is `dist/index.js`.
- `JWT_REFRESH_SECRET` is the correct refresh-secret env var name for this repo. `REFRESH_TOKEN_SECRET` is not read by the app.
- Mixed backend domains cause auth, cookie, and proxy bugs. Use `https://social-media-controller.onrender.com` consistently in Vercel envs.
- `AUTH_HTTPONLY_COOKIES` must stay `true` in production or refresh-cookie session restore breaks.
- `CORS_ORIGIN` must match the exact dashboard origin and cannot be `*` in production.
- `NEXT_PUBLIC_ENABLE_MOCK_BILLING` must be `false` in cloud deploys.
- `dashboard/pages/api/verify-payment.ts`, `dashboard/pages/api/analytics.ts`, and `dashboard/pages/api/analytics/funnel.ts` are already serverless-safe for Vercel.
